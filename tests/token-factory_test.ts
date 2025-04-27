import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v1.0.2/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

// Administrator Management Tests
Clarinet.test({
  name: "Only contract owner can set administrators",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;

    // Attempt to set administrator by non-owner (should fail)
    let block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(true)], 
        wallet2.address)
    ]);

    // Verify transaction failed with unauthorized error
    block.receipts[0].result.expectErr().expectUint(1);

    // Set administrator by deployer (should succeed)
    block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(true)], 
        deployer.address)
    ]);

    // Verify transaction succeeded
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify administrator status
    let adminStatus = chain.callReadOnlyFn(
      "token-factory", 
      "is-admin", 
      [types.principal(wallet1.address)], 
      deployer.address
    );
    adminStatus.result.expectBool(true);
  }
});

Clarinet.test({
  name: "Contract owner can remove administrator privileges",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // First, set wallet1 as administrator
    let block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(true)], 
        deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Remove administrator privileges
    block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(false)], 
        deployer.address)
    ]);

    // Verify transaction succeeded
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify administrator status removed
    let adminStatus = chain.callReadOnlyFn(
      "token-factory", 
      "is-admin", 
      [types.principal(wallet1.address)], 
      deployer.address
    );
    adminStatus.result.expectBool(false);
  }
});

// Token Creation Tests
Clarinet.test({
  name: "Successfully create token with valid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // First, make wallet1 an administrator
    let block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(true)], 
        deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Create a new token
    block = chain.mineBlock([
      Tx.contractCall("token-factory", "create-token", 
        [
          types.ascii("TKCT"),   // symbol
          types.ascii("TokenCraft"), // name
          types.uint(1000000),   // max supply
          types.uint(8)          // decimals
        ], 
        wallet1.address)
    ]);

    // Verify token creation succeeded
    block.receipts[0].result.expectOk().expectBool(true);

    // Verify token details can be retrieved
    let tokenDetails = chain.callReadOnlyFn(
      "token-factory", 
      "get-token-details", 
      [types.ascii("TKCT")], 
      deployer.address
    );
    
    // Check token details match input
    let details = tokenDetails.result.expectSome();
    assertEquals(details.data["name"], "TokenCraft");
    assertEquals(details.data["max-supply"], 1000000n);
    assertEquals(details.data["decimals"], 8n);
  }
});

Clarinet.test({
  name: "Prevent token creation by unauthorized users",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get("wallet_1")!;
    const wallet2 = accounts.get("wallet_2")!;

    // Attempt to create token without admin privileges
    let block = chain.mineBlock([
      Tx.contractCall("token-factory", "create-token", 
        [
          types.ascii("TKCT"),   // symbol
          types.ascii("TokenCraft"), // name
          types.uint(1000000),   // max supply
          types.uint(8)          // decimals
        ], 
        wallet1.address)
    ]);

    // Verify transaction failed with unauthorized error
    block.receipts[0].result.expectErr().expectUint(1);
  }
});

Clarinet.test({
  name: "Block token creation with invalid parameters",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // First, make wallet1 an administrator
    let block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(true)], 
        deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Attempt to create token with zero max supply
    block = chain.mineBlock([
      Tx.contractCall("token-factory", "create-token", 
        [
          types.ascii("TKCT"),   // symbol
          types.ascii("TokenCraft"), // name
          types.uint(0),         // invalid max supply
          types.uint(8)          // decimals
        ], 
        wallet1.address)
    ]);

    // Verify transaction failed with invalid params error
    block.receipts[0].result.expectErr().expectUint(2);
  }
});

Clarinet.test({
  name: "Prevent duplicate token symbol registrations",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const wallet1 = accounts.get("wallet_1")!;

    // First, make wallet1 an administrator
    let block = chain.mineBlock([
      Tx.contractCall("token-factory", "set-administrator", 
        [types.principal(wallet1.address), types.bool(true)], 
        deployer.address)
    ]);
    block.receipts[0].result.expectOk();

    // Create first token
    block = chain.mineBlock([
      Tx.contractCall("token-factory", "create-token", 
        [
          types.ascii("TKCT"),   // symbol
          types.ascii("TokenCraft"), // name
          types.uint(1000000),   // max supply
          types.uint(8)          // decimals
        ], 
        wallet1.address)
    ]);
    block.receipts[0].result.expectOk();

    // Attempt to create token with same symbol
    block = chain.mineBlock([
      Tx.contractCall("token-factory", "create-token", 
        [
          types.ascii("TKCT"),   // duplicate symbol
          types.ascii("AnotherToken"), // different name
          types.uint(500000),    // different max supply
          types.uint(6)          // different decimals
        ], 
        wallet1.address)
    ]);

    // Verify transaction failed with token exists error
    block.receipts[0].result.expectErr().expectUint(3);
  }
});

// Additional Utility Function Tests
Clarinet.test({
  name: "Retrieve contract owner",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;

    // Retrieve contract owner
    let ownerResult = chain.callReadOnlyFn(
      "token-factory", 
      "get-contract-owner", 
      [], 
      deployer.address
    );

    // Verify contract owner matches deployer
    ownerResult.result.expectPrincipal(deployer.address);
  }
});