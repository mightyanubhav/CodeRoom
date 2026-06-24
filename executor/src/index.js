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

// ─── Language config ──────────────────────────────────────────────────────────
const LANGUAGE_CONFIG = {
    PYTHON: {
        image: 'python:3.11-alpine',
        cmd: (code) => ['python3', '-c', code],
    },
    JAVASCRIPT: {
        image: 'node:20-alpine',
        cmd: (code) => ['node', '-e', code],
    },
    JAVA: {
        image: 'eclipse-temurin:21-jdk-alpine',
        // Java needs file write — use sh -c
        cmd: (code) => ['sh', '-c',
            `echo '${code.replace(/'/g, "'\\''")}' > /tmp/Solution.java && javac /tmp/Solution.java -d /tmp && java -cp /tmp Solution`
        ],
    },
    GO: {
        image: 'golang:1.21-alpine',
        cmd: (code) => ['sh', '-c',
            `echo '${code.replace(/'/g, "'\\''")}' > /tmp/main.go && go run /tmp/main.go`
        ],
    },
    CPP: {
        image: 'gcc:13-alpine',
        cmd: (code) => ['sh', '-c',
            `echo '${code.replace(/'/g, "'\\''")}' > /tmp/solution.cpp && g++ /tmp/solution.cpp -o /tmp/solution && /tmp/solution`
        ],
    },
};

// ─── Execute in Docker container ──────────────────────────────────────────────
const executeInDocker = async (code, language, stdin = '') => {
    const config = LANGUAGE_CONFIG[language.toUpperCase()];
    if (!config) throw new Error(`Unsupported language: ${language}`);

    const startTime = Date.now();
    let container = null;

    try {
        container = await docker.createContainer({
            Image: config.image,
            Cmd: config.cmd(code),
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            HostConfig: {
                Memory: 128 * 1024 * 1024,      // 128MB
                CpuPeriod: 100000,
                CpuQuota: 50000,                  // 0.5 CPU
                NetworkMode: 'none',              // no internet
                PidsLimit: 50,                    // no fork bombs
                AutoRemove: true,                 // cleanup automatically
            },
        });

        await container.start();

        // Collect output
        const stream = await container.logs({
            stdout: true,
            stderr: true,
            follow: true,
        });

        let stdout = '';
        let stderr = '';

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                container.kill().catch(() => {});
                reject(new Error('Time limit exceeded (5s)'));
            }, 5000);

            docker.modem.demuxStream(
                stream,
                { write: (chunk) => { stdout += chunk.toString(); } },
                { write: (chunk) => { stderr += chunk.toString(); } }
            );

            stream.on('end', () => {
                clearTimeout(timeout);
                resolve();
            });

            stream.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: 0,
            executionTimeMs: Date.now() - startTime,
            timedOut: false,
        };

    } catch (err) {
        const timedOut = err.message.includes('Time limit');
        return {
            stdout: '',
            stderr: timedOut ? 'Time limit exceeded (5s)' : err.message,
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
        // Single run
        if (!testCases || testCases.length === 0) {
            const result = await executeInDocker(code, language, stdin || '');
            return res.json({
                stdout: result.stdout,
                stderr: result.stderr,
                passed: result.exitCode === 0 && !result.stderr,
                timedOut: result.timedOut,
                executionTimeMs: result.executionTimeMs
            });
        }

        // Run against test cases
        const results = [];
        let passedCount = 0;

        for (const tc of testCases) {
            const result = await executeInDocker(code, language, tc.input || '');
            const actual = result.stdout.trim();
            const expected = tc.expectedOutput.trim();
            const passed = result.exitCode === 0 && actual === expected;

            if (passed) passedCount++;

            results.push({
                input:          tc.hidden ? 'hidden' : tc.input,
                expectedOutput: tc.hidden ? 'hidden' : expected,
                actualOutput:   tc.hidden ? (passed ? 'correct' : 'wrong') : actual,
                passed,
                executionTimeMs: result.executionTimeMs
            });
        }

        return res.json({
            stdout: `${passedCount}/${testCases.length} test cases passed`,
            stderr: '',
            passed: passedCount === testCases.length,
            results,
            executionTimeMs: results.reduce((s, r) => s + r.executionTimeMs, 0)
        });

    } catch (err) {
        console.error('Execute error:', err.message);
        return res.status(500).json({
            stdout: '',
            stderr: 'Executor error: ' + err.message,
            passed: false,
            results: []
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Executor running on port ${PORT}`);
    console.log(`🐳 Using Docker sandbox`);
});