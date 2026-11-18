import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEther } from 'ethers';
import {
  SANDBOX_ADDRESSES,
  approveAndReleaseSandbox,
  computeEscrowMetrics,
  createInitialSandboxState,
  createSandboxJob,
  depositSandboxPayment,
  getUserRoleForJob,
  raiseSandboxDispute,
  resolveSandboxDispute,
  submitSandboxWork,
  validateCreateContractInput,
} from './escrowEngine';
import { JobState } from './types';

const NOW = 1_800_000_000;
const FUTURE_ISO = new Date((NOW + 86400 * 7) * 1000).toISOString();
const PAST_ISO = new Date((NOW - 86400) * 1000).toISOString();

test('validateCreateContractInput enforces Solidity createContract require rules', () => {
  const zeroAddr = validateCreateContractInput(
    {
      title: 'Test Job',
      description: 'Desc',
      amountEth: '0.1',
      deadlineIso: FUTURE_ISO,
      freelancerAddress: '0x0000000000000000000000000000000000000000',
    },
    SANDBOX_ADDRESSES.client,
    NOW
  );
  assert.equal(zeroAddr.ok, false);

  const selfHire = validateCreateContractInput(
    {
      title: 'Test Job',
      description: 'Desc',
      amountEth: '0.1',
      deadlineIso: FUTURE_ISO,
      freelancerAddress: SANDBOX_ADDRESSES.client,
    },
    SANDBOX_ADDRESSES.client,
    NOW
  );
  assert.equal(selfHire.ok, false);

  const zeroAmount = validateCreateContractInput(
    {
      title: 'Test Job',
      description: 'Desc',
      amountEth: '0',
      deadlineIso: FUTURE_ISO,
      freelancerAddress: SANDBOX_ADDRESSES.freelancer,
    },
    SANDBOX_ADDRESSES.client,
    NOW
  );
  assert.equal(zeroAmount.ok, false);

  const pastDeadline = validateCreateContractInput(
    {
      title: 'Test Job',
      description: 'Desc',
      amountEth: '0.1',
      deadlineIso: PAST_ISO,
      freelancerAddress: SANDBOX_ADDRESSES.freelancer,
    },
    SANDBOX_ADDRESSES.client,
    NOW
  );
  assert.equal(pastDeadline.ok, false);

  const valid = validateCreateContractInput(
    {
      title: 'Web App Build',
      description: 'Full stack build',
      amountEth: '0.5',
      deadlineIso: FUTURE_ISO,
      freelancerAddress: SANDBOX_ADDRESSES.freelancer,
    },
    SANDBOX_ADDRESSES.client,
    NOW
  );
  assert.equal(valid.ok, true);
});

test('Full happy path: Create -> Deposit -> Submit -> Approve & Release prevents double payment', () => {
  let state = createInitialSandboxState(NOW);
  const initialEscrow = BigInt(state.contractBalanceWei);
  const initialFreelancerBal = BigInt(state.accounts.freelancer.balanceWei);
  const initialClientBal = BigInt(state.accounts.client.balanceWei);

  // 1. Create Contract
  const created = createSandboxJob(
    state,
    SANDBOX_ADDRESSES.client,
    {
      title: 'Build Landing Page',
      description: 'Responsive corporate page',
      amountEth: '0.4',
      deadlineIso: FUTURE_ISO,
      freelancerAddress: SANDBOX_ADDRESSES.freelancer,
    },
    NOW + 10
  );
  assert.equal(created.ok, true);
  if (!created.ok) return;
  state = created.state;
  const jobId = created.jobId;
  assert.equal(state.jobs.find((j) => j.id === jobId)?.state, JobState.Created);

  // Cannot submit work before funding
  const prematureSubmit = submitSandboxWork(
    state,
    SANDBOX_ADDRESSES.freelancer,
    jobId,
    'https://example.com/work',
    NOW + 20
  );
  assert.equal(prematureSubmit.ok, false);

  // 2. Deposit Payment (wrong amount rejected, wrong actor rejected, exact amount succeeds)
  const wrongDeposit = depositSandboxPayment(
    state,
    SANDBOX_ADDRESSES.client,
    jobId,
    parseEther('0.2'),
    NOW + 20
  );
  assert.equal(wrongDeposit.ok, false);

  const freelancerDeposit = depositSandboxPayment(
    state,
    SANDBOX_ADDRESSES.freelancer,
    jobId,
    parseEther('0.4'),
    NOW + 20
  );
  assert.equal(freelancerDeposit.ok, false);

  const deposited = depositSandboxPayment(
    state,
    SANDBOX_ADDRESSES.client,
    jobId,
    parseEther('0.4'),
    NOW + 25
  );
  assert.equal(deposited.ok, true);
  if (!deposited.ok) return;
  state = deposited.state;
  assert.equal(BigInt(state.contractBalanceWei), initialEscrow + parseEther('0.4'));
  assert.equal(BigInt(state.accounts.client.balanceWei), initialClientBal - parseEther('0.4'));

  // Cannot approve & release before work submission
  const prematureRelease = approveAndReleaseSandbox(
    state,
    SANDBOX_ADDRESSES.client,
    jobId,
    NOW + 30
  );
  assert.equal(prematureRelease.ok, false);

  // 3. Submit Work
  const submitted = submitSandboxWork(
    state,
    SANDBOX_ADDRESSES.freelancer,
    jobId,
    'https://github.com/digitalwork/deliverable-v1',
    NOW + 40
  );
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  state = submitted.state;
  assert.equal(state.jobs.find((j) => j.id === jobId)?.state, JobState.Submitted);

  // 4. Approve & Release Payment
  const released = approveAndReleaseSandbox(state, SANDBOX_ADDRESSES.client, jobId, NOW + 50);
  assert.equal(released.ok, true);
  if (!released.ok) return;
  state = released.state;
  assert.equal(state.jobs.find((j) => j.id === jobId)?.state, JobState.Completed);
  assert.equal(BigInt(state.contractBalanceWei), initialEscrow);
  assert.equal(BigInt(state.accounts.freelancer.balanceWei), initialFreelancerBal + parseEther('0.4'));

  // Business Rule: Prevent double payment!
  const doubleRelease = approveAndReleaseSandbox(state, SANDBOX_ADDRESSES.client, jobId, NOW + 60);
  assert.equal(doubleRelease.ok, false);
});

test('Dispute management: only parties can raise, only admin can resolve to refund or release', () => {
  let state = createInitialSandboxState(NOW);
  // Job #2 is Funded (0.15 ETH)
  const nonPartyDispute = raiseSandboxDispute(state, SANDBOX_ADDRESSES.admin, 2, NOW + 10);
  assert.equal(nonPartyDispute.ok, false);

  const raised = raiseSandboxDispute(state, SANDBOX_ADDRESSES.client, 2, NOW + 20);
  assert.equal(raised.ok, true);
  if (!raised.ok) return;
  state = raised.state;
  assert.equal(state.jobs.find((j) => j.id === 2)?.state, JobState.Disputed);

  // Client cannot resolve dispute themselves
  const clientResolve = resolveSandboxDispute(state, SANDBOX_ADDRESSES.client, 2, false, NOW + 30);
  assert.equal(clientResolve.ok, false);

  // Admin resolves dispute by refunding Client
  const clientBalBefore = BigInt(state.accounts.client.balanceWei);
  const resolved = resolveSandboxDispute(state, SANDBOX_ADDRESSES.admin, 2, false, NOW + 40);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  state = resolved.state;

  assert.equal(state.jobs.find((j) => j.id === 2)?.state, JobState.Refunded);
  assert.equal(BigInt(state.accounts.client.balanceWei), clientBalBefore + parseEther('0.15'));

  // Cannot resolve twice
  const doubleResolve = resolveSandboxDispute(state, SANDBOX_ADDRESSES.admin, 2, true, NOW + 50);
  assert.equal(doubleResolve.ok, false);
});

test('getUserRoleForJob and computeEscrowMetrics compute accurately', () => {
  const state = createInitialSandboxState(NOW);
  const job1 = state.jobs[0];
  assert.equal(getUserRoleForJob(SANDBOX_ADDRESSES.client, job1, state.admin), 'client');
  assert.equal(getUserRoleForJob(SANDBOX_ADDRESSES.freelancer, job1, state.admin), 'freelancer');
  assert.equal(getUserRoleForJob(state.admin, job1, state.admin), 'admin');
  assert.equal(
    getUserRoleForJob('0x1111111111111111111111111111111111111111', job1, state.admin),
    'viewer'
  );

  const metrics = computeEscrowMetrics(state.jobs, state.contractBalanceWei);
  assert.equal(metrics.totalJobs, 4);
  assert.equal(metrics.activeDisputes, 1);
  assert.equal(metrics.escrowLockedWei, parseEther('0.70'));
  assert.equal(metrics.completedPayoutsWei, parseEther('0.12'));
});
