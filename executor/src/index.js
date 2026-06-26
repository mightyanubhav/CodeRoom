import express from 'express';
import Docker from 'dockerode';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
dotenv.config();

const app = express();
app.use(express.json());

const docker = new Docker();

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many requests' }
});

// ─── Inject stdin into code (for languages that support it) ──────────────────
const injectStdin = (code, language, stdin) => {
    if (!stdin) return code;

    switch (language.toUpperCase()) {
        case 'PYTHON': {
            // Inject stdin via sys.stdin override
            const escaped = stdin
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
            return `import sys\nsys.stdin = __import__('io').StringIO('${escaped}\\n')\n${code}`;
        }
        default:
            // For Java, JS, Go, C++ — use shell pipe (handled in cmd builder)
            return code;
    }
};

// ─── Language config ──────────────────────────────────────────────────────────
// For languages that can't inject stdin into code,
// we use shell pipe: echo 'stdin' | run_command
const buildCmd = (language, code, stdin) => {
    const escaped = (str) => str.replace(/'/g, "'\\''");
    const stdinEsc = escaped(stdin || '');
    const codeEsc  = escaped(code);

    switch (language.toUpperCase()) {
        case 'PYTHON':
            // Python uses sys.stdin injection — no shell pipe needed
            return ['python3', '-c', injectStdin(code, 'PYTHON', stdin)];

        case 'JAVASCRIPT':
            // Node reads from stdin via readline — pipe it
            return ['sh', '-c',
                `echo '${stdinEsc}' | node -e '${codeEsc}'`
            ];

        case 'JAVA':
            // Write file, compile, pipe stdin to run
            return ['sh', '-c',
                `printf '%s' '${codeEsc}' > /tmp/Solution.java && ` +
                `javac /tmp/Solution.java -d /tmp && ` +
                `echo '${stdinEsc}' | java -cp /tmp Solution`
            ];

        case 'GO':
            return ['sh', '-c',
                `printf '%s' '${codeEsc}' > /tmp/main.go && ` +
                `echo '${stdinEsc}' | GO111MODULE=off go run /tmp/main.go`
            ];

        case 'CPP':
            return ['sh', '-c',
                `printf '%s' '${codeEsc}' > /tmp/solution.cpp && ` +
                `g++ /tmp/solution.cpp -o /tmp/solution && ` +
                `echo '${stdinEsc}' | /tmp/solution`
            ];

        default:
            throw new Error(`Unsupported language: ${language}`);
    }
};

const LANGUAGE_IMAGES = {
    PYTHON:     'python:3.11-alpine',
    JAVASCRIPT: 'node:20-alpine',
    JAVA:       'eclipse-temurin:21-jdk-alpine',
    GO:         'golang:1.21-alpine',
    CPP:        'gcc:13',
};

// ─── Pull image if not present locally (deduplicates concurrent pulls) ────────
const pullPromises = new Map();

const ensureImage = async (image) => {
    const found = await docker.listImages({ filters: { reference: [image] } });
    if (found.length > 0) return;

    // If a pull is already in progress for this image, wait for it
    if (pullPromises.has(image)) return pullPromises.get(image);

    console.log(`Pulling image: ${image} ...`);
    const p = new Promise((resolve, reject) => {
        docker.pull(image, (err, stream) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, pullErr => pullErr ? reject(pullErr) : resolve());
        });
    }).then(() => {
        console.log(`Image ready: ${image}`);
        pullPromises.delete(image);
    }).catch(err => {
        pullPromises.delete(image);
        throw err;
    });

    pullPromises.set(image, p);
    return p;
};

// Compiled languages need more time: container start + compile + run
const LANGUAGE_TIMEOUTS = {
    PYTHON:     10000,
    JAVASCRIPT: 10000,
    JAVA:       25000,
    GO:         20000,
    CPP:        20000,
};

// ─── Execute in Docker container ──────────────────────────────────────────────
const executeInDocker = async (code, language, stdin = '') => {
    const lang = language.toUpperCase();
    const image = LANGUAGE_IMAGES[lang];
    if (!image) throw new Error(`Unsupported language: ${language}`);

    const timeoutMs = LANGUAGE_TIMEOUTS[lang] || 10000;
    const startTime = Date.now();
    let container = null;

    try {
        await ensureImage(image);
        const cmd = buildCmd(lang, code, stdin);

        container = await docker.createContainer({
            Image: image,
            Cmd: cmd,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            HostConfig: {
                Memory: 128 * 1024 * 1024,
                CpuPeriod: 100000,
                CpuQuota: 50000,
                NetworkMode: 'none',
                PidsLimit: 50,
            },
        });

        await container.start();
        // Register wait BEFORE reading logs to avoid race with container exit
        const waitPromise = container.wait();

        const stream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
        });

        let stdout = '';
        let stderr = '';

        await new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                container.kill().catch(() => {});
                reject(new Error(`Time limit exceeded (${timeoutMs / 1000}s)`));
            }, timeoutMs);

            docker.modem.demuxStream(
                stream,
                { write: (chunk) => { stdout += chunk.toString(); } },
                { write: (chunk) => { stderr += chunk.toString(); } }
            );

            stream.on('end', () => {
                clearTimeout(timeoutHandle);
                resolve();
            });

            stream.on('error', (err) => {
                clearTimeout(timeoutHandle);
                reject(err);
            });
        });

        const waitResult = await waitPromise;
        const exitCode = waitResult.StatusCode;

        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
            executionTimeMs: Date.now() - startTime,
            timedOut: false,
        };

    } catch (err) {
        const timedOut = err.message.includes('Time limit');
        return {
            stdout: '',
            stderr: timedOut ? err.message : err.message,
            exitCode: 1,
            executionTimeMs: Date.now() - startTime,
            timedOut,
        };
    } finally {
        if (container) {
            try { await container.remove({ force: true }); } catch (_) {}
        }
    }
};

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await docker.ping();
        res.json({
            status: 'ok',
            service: 'coderoom-executor',
            engine: 'docker',
            timestamp: new Date().toISOString()
        });
    } catch {
        res.status(500).json({ status: 'error', message: 'Docker not available' });
    }
});

// ─── Execute endpoint ─────────────────────────────────────────────────────────
app.post('/execute', limiter, async (req, res) => {
    const { code, language, stdin, testCases } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'code and language required' });
    }

    try {
        // Single run — no test cases
        if (!testCases || testCases.length === 0) {
            const result = await executeInDocker(code, language, stdin || '');
            return res.json({
                stdout:          result.stdout,
                stderr:          result.stderr,
                passed:          result.exitCode === 0 && !result.stderr,
                timedOut:        result.timedOut,
                executionTimeMs: result.executionTimeMs
            });
        }

        // Run against test cases
        const results = [];
        let passedCount = 0;

        for (const tc of testCases) {
            const result = await executeInDocker(code, language, tc.input || '');
            const actual   = result.stdout.trim();
            const expected = tc.expectedOutput.trim();

            // Normalize true/false casing for Java (prints "true") vs Python (prints "True")
            const normalizeOutput = (s) => s.toLowerCase().trim();
            const passed = result.exitCode === 0 &&
                           !result.stderr &&
                           (actual === expected ||
                            normalizeOutput(actual) === normalizeOutput(expected));

            if (passed) passedCount++;

            results.push({
                input:           tc.hidden ? 'hidden' : tc.input,
                expectedOutput:  tc.hidden ? 'hidden' : expected,
                actualOutput:    tc.hidden ? (passed ? 'correct' : 'wrong') : actual,
                passed,
                executionTimeMs: result.executionTimeMs
            });
        }

        return res.json({
            stdout:          `${passedCount}/${testCases.length} test cases passed`,
            stderr:          '',
            passed:          passedCount === testCases.length,
            results,
            executionTimeMs: results.reduce((s, r) => s + r.executionTimeMs, 0)
        });

    } catch (err) {
        console.error('Execute error:', err.message);
        return res.status(500).json({
            stdout:  '',
            stderr:  'Executor error: ' + err.message,
            passed:  false,
            results: []
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Executor running on port ${PORT}`);
    console.log(`🐳 Using Docker sandbox`);

    // Pre-pull all images in background so first executions don't wait for downloads
    const images = [...new Set(Object.values(LANGUAGE_IMAGES))];
    console.log(`📦 Pre-pulling language images: ${images.join(', ')}`);
    Promise.all(
        images.map(img =>
            ensureImage(img).catch(err =>
                console.error(`❌ Failed to pre-pull ${img}:`, err.message)
            )
        )
    ).then(() => console.log('✅ All language images ready'));
});