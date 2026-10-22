#!/usr/bin/env node
/**
 * 播放器滚动锚定检查的机读出口：跑 a/b 两套策略，汇总每轮 JSON，按退出码给结论。
 *
 * 为什么要包一层：`playwright test` 只会给 0/1，而这里要区分四种结局——
 * 过了、红了、**空通过**（一条断言都没识别到，不算过）、环境不符（比如没有埋点、node 不是 22）。
 * 分层排查时，「空通过」和「环境不符」是最容易被误读成绿灯的两类，所以必须各占一个退出码。
 *
 * 退出码：
 * - 0 通过：两套策略都跑出观测数据，且全部断言成立；
 * - 1 红：有观测不成立（守卫不成立 / 残差超限 / 出现不该有的滚动请求），或 playwright 自身失败；
 * - 3 空通过：识别到 0 条观测（用例没跑起来/没打印结果），不算过；
 * - 4 环境不符：node 不是 22，或所有观测都报告埋点缺失（`__dpDebug` 不存在）。
 *
 * 用法：`node qa/tools/check-player-scroll.mjs`（先跑过一次用例，或让 globalSetup 备好料）
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** 仓库根目录。 */
const projectDir = fileURLToPath(new URL('../..', import.meta.url));

/** 用例文件（相对仓库根）。 */
const SPEC_FILE = 'qa/specs/player/player-scroll-anchor.spec.ts';

/** 观测日志前缀，与用例里的 console.log 保持一致。 */
const OBSERVATION_PREFIX = '[player-scroll-anchor] ';

/** 需要跑的策略。 */
const POLICIES = ['a', 'b'];

/** 期望的 node 主版本（项目 pin 在 22）。 */
const REQUIRED_NODE_MAJOR = 22;

/**
 * 跑一套策略，返回观测数组与 playwright 退出码。
 *
 * @param policy 策略（a / b）。
 * @returns 观测数组、退出码与原始输出尾部。
 */
function runPolicy(policy) {
    const result = spawnSync(
        process.execPath,
        [path.join(projectDir, 'node_modules', 'playwright', 'cli.js'), 'test', '-c', 'qa/playwright.config.ts', SPEC_FILE],
        {
            cwd: projectDir,
            env: { ...process.env, DP_POLICY: policy },
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
        },
    );
    const stdout = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const observations = [];
    for (const line of stdout.split('\n')) {
        const at = line.indexOf(OBSERVATION_PREFIX);
        if (at < 0) {
            continue;
        }
        const raw = line.slice(at + OBSERVATION_PREFIX.length).trim();
        try {
            observations.push(JSON.parse(raw));
        } catch {
            // 解析不了的行直接丢弃：宁可少一条观测（可能触发空通过），也不要吞掉格式错误
        }
    }
    return { policy, observations, exitCode: result.status, tail: stdout.split('\n').slice(-8).join('\n') };
}

/**
 * 判定一条观测是否成立。
 *
 * 守卫（起点落在中段、行高确实变化、锚点行仍在渲染）与策略断言都在这里重新核一遍：
 * 机读出口不信任 playwright 的退出码，只信任观测数据本身。
 *
 * @param observation 一条观测。
 * @returns 失败原因列表；空数组表示成立。
 */
function judge(observation) {
    const failures = [];
    const guardHolds = observation.guardHolds === true;
    if (observation.case === 'grow') {
        if (!guardHolds) {
            failures.push('守卫不成立');
        }
        if (observation.instrumentation !== 'absent') {
            if (observation.policy === 'a') {
                if (!(typeof observation.residual === 'number' && Math.abs(observation.residual) < 1)) {
                    failures.push('末轮残差 ≥ 1 布局像素');
                }
                if (!(observation.requestCount <= 3)) {
                    failures.push('请求类滚动写入超过 3 次');
                }
            } else if (observation.requestCount !== 0) {
                failures.push('对照策略出现了请求类滚动写入');
            }
        }
        return failures;
    }
    // 锚点行被回收：守卫本就不成立（这条用例的目的是证明 fail closed）
    if (observation.verdict !== 'red') {
        failures.push('锚点行被回收时守卫竟然成立');
    }
    if (observation.instrumentation !== 'absent' && observation.requestCount !== 0) {
        failures.push('锚点缺失时仍请求了滚动');
    }
    return failures;
}

/**
 * 汇总并打印结论。
 *
 * @returns 退出码。
 */
function main() {
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const runs = POLICIES.map((policy) => runPolicy(policy));
    const observations = runs.flatMap((run) => run.observations);

    const checks = observations.map((observation) => ({
        policy: observation.policy,
        case: observation.case,
        round: observation.round,
        instrumentation: observation.instrumentation,
        residual: observation.residual,
        requestCount: observation.requestCount,
        writeCount: observation.writeCount,
        guardHolds: observation.guardHolds,
        verdict: observation.verdict,
        failures: judge(observation),
    }));

    const summary = {
        check: 'player-scroll-anchor',
        nodeVersion: process.versions.node,
        requiredNodeMajor: REQUIRED_NODE_MAJOR,
        assertionCount: checks.length,
        playwrightExitCodes: runs.map((run) => ({ policy: run.policy, exitCode: run.exitCode })),
        instrumentation: observations.every((observation) => observation.instrumentation === 'absent')
            ? 'absent'
            : 'present',
        failures: checks.filter((check) => check.failures.length > 0),
        checks,
    };
    console.log(JSON.stringify(summary, null, 2));

    if (nodeMajor !== REQUIRED_NODE_MAJOR) {
        console.error(`[check] 环境不符：node ${process.versions.node}（需要 ${REQUIRED_NODE_MAJOR}.x）`);
        return 4;
    }
    if (summary.instrumentation === 'absent') {
        console.error('[check] 环境不符：所有观测都报告埋点缺失（window.__dpDebug 不存在）');
        for (const run of runs) {
            console.error(run.tail);
        }
        return 4;
    }
    if (checks.length === 0) {
        console.error('[check] 空通过：没有识别到任何观测，不算过');
        for (const run of runs) {
            console.error(run.tail);
        }
        return 3;
    }
    if (summary.failures.length > 0 || runs.some((run) => run.exitCode !== 0)) {
        console.error(`[check] 红：${summary.failures.length} 条观测不成立`);
        for (const run of runs) {
            console.error(run.tail);
        }
        return 1;
    }
    console.error(`[check] 通过：${checks.length} 条观测全部成立`);
    return 0;
}

process.exitCode = main();
