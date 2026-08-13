import assert from 'assert';
import { parseGhAuthStatus, parseGhVersion, parseLoginProgress, parseLoginUsername, looksLikeUserCancelledLogin } from '../voidGitHubParsing.js';

suite('voidGitHubParsing', () => {

	test('parseGhVersion extracts semver from gh --version output', () => {
		assert.strictEqual(parseGhVersion('gh version 2.45.0 (2024-03-04)\nhttps://github.com/cli/cli/releases/tag/v2.45.0\n'), '2.45.0');
	});

	test('parseGhVersion returns null on unrecognized output', () => {
		assert.strictEqual(parseGhVersion('command not found'), null);
	});

	test('parseGhAuthStatus parses a single github.com account', () => {
		const output = `github.com
  ✓ Logged in to github.com account octocat (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo'
`;
		const accounts = parseGhAuthStatus(output);
		assert.strictEqual(accounts.length, 1);
		assert.strictEqual(accounts[0].login, 'octocat');
		assert.strictEqual(accounts[0].isActive, true);
	});

	test('parseGhAuthStatus parses multiple accounts and identifies the active one', () => {
		const output = `github.com
  ✓ Logged in to github.com account octocat (keyring)
  - Active account: true
  - Git operations protocol: https

  ✓ Logged in to github.com account monalisa (keyring)
  - Active account: false
  - Git operations protocol: https
`;
		const accounts = parseGhAuthStatus(output);
		assert.strictEqual(accounts.length, 2);
		assert.deepStrictEqual(accounts.map(a => [a.login, a.isActive]), [['octocat', true], ['monalisa', false]]);
	});

	test('parseGhAuthStatus ignores non-github.com hosts', () => {
		const output = `github.mycompany.com
  ✓ Logged in to github.mycompany.com account enterprise-user (keyring)
  - Active account: true

github.com
  ✓ Logged in to github.com account octocat (keyring)
  - Active account: true
`;
		const accounts = parseGhAuthStatus(output);
		assert.strictEqual(accounts.length, 1);
		assert.strictEqual(accounts[0].login, 'octocat');
	});

	test('parseGhAuthStatus returns an empty list when nobody is logged in', () => {
		assert.deepStrictEqual(parseGhAuthStatus('You are not logged into any GitHub hosts.\n'), []);
	});

	test('parseLoginProgress extracts the one-time code', () => {
		const chunk = '! First copy your one-time code: ABCD-1234\nPress Enter to open github.com in your browser...\n';
		const result = parseLoginProgress(chunk);
		assert.deepStrictEqual(result, { code: 'ABCD-1234', verificationUri: 'https://github.com/login/device' });
	});

	test('parseLoginProgress returns null when no code is present', () => {
		assert.strictEqual(parseLoginProgress('Opening github.com ...\n'), null);
	});

	test('parseLoginUsername extracts the confirmed username', () => {
		assert.strictEqual(parseLoginUsername('✓ Authentication complete.\n✓ Logged in as octocat\n'), 'octocat');
	});

	test('parseLoginUsername returns null when absent', () => {
		assert.strictEqual(parseLoginUsername('some unrelated output'), null);
	});

	test('looksLikeUserCancelledLogin detects cancellation phrasing', () => {
		assert.strictEqual(looksLikeUserCancelledLogin('Error: Cancelled by user'), true);
		assert.strictEqual(looksLikeUserCancelledLogin('exit status 1: interrupted'), true);
		assert.strictEqual(looksLikeUserCancelledLogin('net/http: TLS handshake timeout'), false);
	});
});
