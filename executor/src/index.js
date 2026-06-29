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

const LANGUAGE_IMAGES = {
    PYTHON:     'python:3.11-alpine',
    JAVASCRIPT: 'node:20-alpine',
    JAVA:       'eclipse-temurin:21-jdk-alpine',
    GO:         'golang:1.21-alpine',
    CPP:        'gcc:13',
};

const LANGUAGE_TIMEOUTS = {
    PYTHON:     8000,
    JAVASCRIPT: 8000,
    JAVA:       25000,  // compile + run in same container
    GO:         20000,
    CPP:        20000,
};

// ─── Image pull ───────────────────────────────────────────────────────────────
const pullPromises = new Map();

const ensureImage = async (image) => {
    const found = await docker.listImages({ filters: { reference: [image] } });
    if (found.length > 0) return;
    if (pullPromises.has(image)) return pullPromises.get(image);

    console.log(`Pulling image: ${image} ...`);
    const p = new Promise((resolve, reject) => {
        docker.pull(image, (err, stream) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream,
                pullErr => pullErr ? reject(pullErr) : resolve());
        });
    }).then(() => {
        pullPromises.delete(image);
        console.log(`Image ready: ${image}`);
    }).catch(err => {
        pullPromises.delete(image);
        throw err;
    });

    pullPromises.set(image, p);
    return p;
};

// ─── Inject stdin — Python only ───────────────────────────────────────────────
const injectStdin = (code, stdin) => {
    if (!stdin) return code;
    const escaped = stdin
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
    return `import sys\nsys.stdin = __import__('io').StringIO('${escaped}\\n')\n${code}`;
};

// ─── Build command — compile + run in ONE container per test case ─────────────
const buildCmd = (language, code, stdin) => {
    const esc      = (str) => str.replace(/'/g, "'\\''");
    const stdinEsc = esc(stdin || '');
    const codeEsc  = esc(code);

    switch (language) {
        case 'PYTHON':
            // Inject stdin directly — no shell needed
            return ['python3', '-c', injectStdin(code, stdin)];

        case 'JAVASCRIPT':
            return ['sh', '-c',
                `echo '${stdinEsc}' | node -e '${codeEsc}'`
            ];

        case 'JAVA':
            // Write + compile + run — all in one sh -c
            // Each container gets fresh /tmp so no conflict between parallel runs
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

// ─── Run a single command in Docker ──────────────────────────────────────────
const runInDocker = async (image, cmd, timeoutMs = 10000) => {
    let container = null;
    const startTime = Date.now();

    try {
        container = await docker.createContainer({
            Image: image,
            Cmd:   cmd,
            AttachStdout: true,
            AttachStderr: true,
            Tty:   false,
            HostConfig: {
                Memory:      128 * 1024 * 1024,
                CpuPeriod:   100000,
                CpuQuota:    50000,
                NetworkMode: 'none',
                PidsLimit:   50,
            },
        });

        await container.start();
        const waitPromise = container.wait();

        const stream = await container.logs({
            stdout: true, stderr: true, follow: true,
        });

        let stdout = '';
        let stderr = '';

        await new Promise((resolve, reject) => {
            const handle = setTimeout(() => {
                container.kill().catch(() => {});
                reject(new Error(`Time limit exceeded (${timeoutMs / 1000}s)`));
            }, timeoutMs);

            docker.modem.demuxStream(
                stream,
                { write: (c) => { stdout += c.toString(); } },
                { write: (c) => { stderr += c.toString(); } }
            );

            stream.on('end',   () => { clearTimeout(handle); resolve(); });
            stream.on('error', (e) => { clearTimeout(handle); reject(e); });
        });

        const { StatusCode: exitCode } = await waitPromise;

        return {
            stdout:          stdout.trim(),
            stderr:          stderr.trim(),
            exitCode,
            executionTimeMs: Date.now() - startTime,
            timedOut:        false,
        };

    } catch (err) {
        return {
            stdout:          '',
            stderr:          err.message,
            exitCode:        1,
            executionTimeMs: Date.now() - startTime,
            timedOut:        err.message.includes('Time limit'),
        };
    } finally {
        if (container) {
            try { await container.remove({ force: true }); } catch (_) {}
        }
    }
};

// ─── Execute single run (no test cases) ──────────────────────────────────────
const executeInDocker = async (code, language, stdin = '') => {
    const lang  = language.toUpperCase();
    const image = LANGUAGE_IMAGES[lang];
    if (!image) throw new Error(`Unsupported: ${language}`);
    await ensureImage(image);
    const cmd = buildCmd(lang, code, stdin);
    return runInDocker(image, cmd, LANGUAGE_TIMEOUTS[lang]);
};

// ─── Execute with test cases — all parallel, each container self-contained ────
const executeWithTestCases = async (code, language, testCases) => {
    const lang  = language.toUpperCase();
    const image = LANGUAGE_IMAGES[lang];
    if (!image) throw new Error(`Unsupported: ${language}`);

    await ensureImage(image);

    console.log(`⚡ Running ${testCases.length} ${lang} test cases in parallel`);

    // Each test case runs in its own container with full compile + run
    // Parallel = fast, isolated = no shared state issues
    const runResults = await Promise.all(
        testCases.map(tc =>
            runInDocker(
                image,
                buildCmd(lang, code, tc.input || ''),
                LANGUAGE_TIMEOUTS[lang]
            )
        )
    );

    return processResults(testCases, runResults);
};

// ─── Normalize output for comparison ─────────────────────────────────────────
const normalize = (s) => s.toLowerCase().trim();

// ─── Process results ──────────────────────────────────────────────────────────
const processResults = (testCases, runResults) => {
    const results   = [];
    let passedCount = 0;
    const allStdout = [];
    const allStderr = [];

    for (let i = 0; i < testCases.length; i++) {
        const tc     = testCases[i];
        const result = runResults[i];
        const actual   = result.stdout.trim();
        const expected = tc.expectedOutput.trim();

        const passed = result.exitCode === 0 &&
                       !result.stderr &&
                       normalize(actual) === normalize(expected);

        if (passed) passedCount++;

        if (result.stdout.trim()) {
            allStdout.push(
                `[Case ${i + 1}] ${tc.hidden ? '(hidden)' : `Input: ${tc.input}`}\n` +
                `${result.stdout.trim()}`
            );
        }
        if (result.stderr.trim()) {
            allStderr.push(`[Case ${i + 1}] ${result.stderr.trim()}`);
        }

        results.push({
            input:           tc.hidden ? 'hidden' : tc.input,
            expectedOutput:  tc.hidden ? 'hidden' : expected,
            actualOutput:    tc.hidden
                ? (passed ? 'correct' : 'wrong')
                : actual,
            passed,
            stderr:          result.stderr.trim() || '',
            executionTimeMs: result.executionTimeMs,
        });
    }

    return {
        results,
        passedCount,
        allStdout: allStdout.join('\n\n---\n\n'),
        allStderr: allStderr.join('\n\n---\n\n'),
        compileError: null,
    };
};

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await docker.ping();
        res.json({
            status:    'ok',
            service:   'coderoom-executor',
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

    const startTime = Date.now();

    try {
        // ── Single run — no test cases ────────────────────────────────────────
        if (!testCases || testCases.length === 0) {
            const result = await executeInDocker(code, language, stdin || '');
            return res.json({
                stdout:          result.stdout,
                stderr:          result.stderr,
                passed:          result.exitCode === 0 && !result.stderr,
                timedOut:        result.timedOut,
                executionTimeMs: result.executionTimeMs,
            });
        }

        // ── Test cases — parallel execution ───────────────────────────────────
        const { results, passedCount, allStdout, allStderr, compileError } =
            await executeWithTestCases(code, language, testCases);

        const totalTime = Date.now() - startTime;
        console.log(`✅ ${language} — ${passedCount}/${testCases.length} passed in ${totalTime}ms`);

        return res.json({
            stdout:          allStdout,
            stderr:          compileError || allStderr,
            passed:          passedCount === testCases.length,
            results,
            executionTimeMs: totalTime,
            summary:         `${passedCount}/${testCases.length} test cases passed`,
        });

    } catch (err) {
        console.error('Execute error:', err.message);
        return res.status(500).json({
            stdout:  '',
            stderr:  'Executor error: ' + err.message,
            passed:  false,
            results: [],
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Executor running on port ${PORT}`);
    console.log(`🐳 Using Docker sandbox`);

    const images = [...new Set(Object.values(LANGUAGE_IMAGES))];
    Promise.all(
        images.map(img =>
            ensureImage(img).catch(err =>
                console.error(`❌ Failed to pre-pull ${img}:`, err.message)
            )
        )
    ).then(() => console.log('✅ All language images ready'));
});