// Runs the compiled contract on an in-memory chain and checks the add → advance → finish round trip.
// Usage (from the project root): node tools/compile.mjs && node tools/test-contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/ScholarQuest.json'), 'utf8'));

const provider = new BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'merge' } }));
const [alice, bob] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);

const contract = await (await new ContractFactory(abi, bytecode, alice).deploy()).waitForDeployment();
const events = (receipt) => receipt.logs.map((l) => contract.interface.parseLog(l));
const reverts = async (call, name) => {
  await assert.rejects(call, (e) => e.revert?.name === name, `expected ${name}`);
};
const deadline = 1798761599n; // 31 Dec 2026
// ganache under-estimates gas for writes into an already-used storage slot, so pin it
const GAS = { gasLimit: 200000 };

// addApplication starts at stage 1 and stamps it
const added = await (await contract.addApplication('Demo Global Scholarship', 'https://example.org/apply', 0, deadline)).wait();
console.log(`addApplication gas: ${added.gasUsed}`);
assert.deepEqual(events(added).map((e) => e.name), ['ApplicationAdded', 'StageAdvanced']);
assert.equal(events(added)[0].args.scholar, alice.address);
assert.equal(events(added)[1].args.stage, 1n);

let [app] = await contract.getApplications(alice.address);
assert.deepEqual([app.program, app.link, app.kind, app.deadline, app.stage, app.result], ['Demo Global Scholarship', 'https://example.org/apply', 0n, deadline, 1n, 0n]);
let times = await contract.getStageTimes(alice.address, 0);
assert.equal(times[0], app.createdAt);
assert.ok(times.slice(1).every((t) => t === 0n));

// can't finish before the decision stage
await reverts(contract.finish.staticCall(0, true), 'NotAtDecision');

// advance through 2..5, each stamped
for (let stage = 2n; stage <= 5n; stage++) {
  const r = await (await contract.advance(0, GAS)).wait();
  if (stage === 2n) console.log(`advance gas: ${r.gasUsed}`);
  assert.equal(events(r)[0].args.stage, stage);
}
[app] = await contract.getApplications(alice.address);
assert.equal(app.stage, 5n);
await reverts(contract.advance.staticCall(0), 'AtFinalStage');

const finished = await (await contract.finish(0, true, GAS)).wait();
console.log(`finish gas: ${finished.gasUsed}`);
assert.equal(events(finished)[0].name, 'ApplicationFinished');
assert.equal(events(finished)[0].args.won, true);
[app] = await contract.getApplications(alice.address);
assert.equal(app.result, 1n);
times = await contract.getStageTimes(alice.address, 0);
assert.ok(times.every((t) => t > 0n));
for (let i = 1; i < 6; i++) assert.ok(times[i] >= times[i - 1]);

// locked once finished
await reverts(contract.finish.staticCall(0, false), 'AlreadyFinished');
await reverts(contract.advance.staticCall(0), 'AlreadyFinished');

// "not this time" stores result 2
await (await contract.addApplication('Demo Founders Accelerator', '', 2, deadline)).wait();
for (let i = 0; i < 4; i++) await (await contract.advance(1, GAS)).wait();
await (await contract.finish(1, false, GAS)).wait();
assert.equal((await contract.getApplications(alice.address))[1].result, 2n);

// each wallet owns its own applications; others can't advance them
await reverts(contract.connect(bob).advance.staticCall(0), 'ApplicationNotFound');
await (await contract.connect(bob).addApplication('Demo Research Grant', '', 1, deadline)).wait();
assert.equal((await contract.getApplications(alice.address)).length, 2);
assert.equal((await contract.getApplications(bob.address)).length, 1);
assert.equal((await contract.getApplications((await provider.getSigner(2)).address)).length, 0);

// StageAdvanced logs line up with the stamped stages, which the UI uses for tx links
const logs = await contract.queryFilter(contract.filters.StageAdvanced(alice.address, 0));
assert.deepEqual(logs.map((l) => l.args.stage), [1n, 2n, 3n, 4n, 5n]);

await reverts(contract.addApplication.staticCall('', '', 0, deadline), 'EmptyProgram');
await reverts(contract.addApplication.staticCall('x'.repeat(81), '', 0, deadline), 'TextTooLong');
await reverts(contract.addApplication.staticCall('X', 'y'.repeat(201), 0, deadline), 'TextTooLong');
await reverts(contract.addApplication.staticCall('X', '', 3, deadline), 'InvalidKind');
await reverts(contract.addApplication.staticCall('X', '', 0, 0), 'NoDeadline');
await reverts(contract.advance.staticCall(9), 'ApplicationNotFound');

console.log('all contract checks passed');
