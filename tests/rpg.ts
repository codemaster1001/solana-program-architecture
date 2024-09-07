import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rpg } from "../target/types/rpg";
import IDL from "../target/idl/rpg.json";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import web3 from "@solana/web3.js"
 
describe("RPG", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
 
  const program = anchor.workspace.Rpg as Program<Rpg>;
  const wallet = anchor.workspace.Rpg.provider.wallet
    .payer as anchor.web3.Keypair;
  const gameMaster = wallet;
  const player = wallet;
 
  const treasury = anchor.web3.Keypair.generate();
 
  it("Create Game", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId,
    );
   
    const txHash = await program.methods
      .createGame(
        8, // 8 Items per player
      )
      .accounts({
        gameMaster: gameMaster.publicKey,
        treasury: treasury.publicKey,
      })
      .signers([treasury])
      .rpc();
   
    await program.provider.connection.confirmTransaction(txHash);
   
    // Print out if you'd like
    // const account = await program.account.game.fetch(gameKey);
  });
 
  it("Create Player", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId,
    );
   
    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId,
    );
   
    const txHash = await program.methods
      .createPlayer()
      .accounts({
        game: gameKey,
        player: player.publicKey,
      })
      .rpc();
   
    await program.provider.connection.confirmTransaction(txHash);
   
    // Print out if you'd like
    // const account = await program.account.player.fetch(playerKey);
  });
   
  it("Spawn Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId,
    );
   
    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId,
    );
   
    const playerAccount = await program.account.player.fetch(playerKey);
   
    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("MONSTER"),
        gameKey.toBuffer(),
        player.publicKey.toBuffer(),
        playerAccount.nextMonsterIndex.toBuffer("le", 8),
      ],
      program.programId,
    );
   
    const txHash = await program.methods
      .spawnMonster()
      .accounts({
        playerAccount: playerKey,
      })
      .rpc();
   
    await program.provider.connection.confirmTransaction(txHash);
   
    // Print out if you'd like
    // const account = await program.account.monster.fetch(monsterKey);
  });
   
  it("Attack Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId,
    );
   
    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId,
    );
   
    // Fetch the latest monster created
    const playerAccount = await program.account.player.fetch(playerKey);
    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("MONSTER"),
        gameKey.toBuffer(),
        player.publicKey.toBuffer(),
        playerAccount.nextMonsterIndex.subn(1).toBuffer("le", 8),
      ],
      program.programId,
    );
   
    const txHash = await program.methods
      .attackMonster()
      .accounts({
        playerAccount: playerKey,
        monster: monsterKey,
      })
      .rpc();
   
    await program.provider.connection.confirmTransaction(txHash);
   
    // Print out if you'd like
    // const account = await program.account.monster.fetch(monsterKey);
   
    const monsterAccount = await program.account.monster.fetch(monsterKey);
    assert(monsterAccount.hitpoints.eqn(99));
  });

  it("Deposit Action Points", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId,
    );
   
    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId,
    );
   
    // To show that anyone can deposit the action points
    // Ie, give this to a clockwork bot
    const clockworkWallet = wallet;
   
    // To give it a starting balance
    const clockworkProvider = new anchor.AnchorProvider(
      program.provider.connection,
      new NodeWallet(clockworkWallet),
      anchor.AnchorProvider.defaultOptions(),
    );
    const clockworkProgram = new anchor.Program<Rpg>(
      IDL as Rpg,
      clockworkProvider,
    );
   
    // Have to give the accounts some lamports else the tx will fail
    const amountToInitialize = 10000000000;

    
   
    // const clockworkAirdropTx =
    //   await clockworkProgram.provider.connection.requestAirdrop(
    //     clockworkWallet.publicKey,
    //     amountToInitialize,
    //   );

    // const treasuryAirdropTx =
    //   await clockworkProgram.provider.connection.requestAirdrop(
    //     treasury.publicKey,
    //     amountToInitialize,
    //   );
    // await program.provider.connection.confirmTransaction(
    //   treasuryAirdropTx,
    //   "confirmed",    // const treasuryAirdropTx =
    //   await clockworkProgram.provider.connection.requestAirdrop(
    //     treasury.publicKey,
    //     amountToInitialize,
    //   );
    // await program.provider.connection.confirmTransaction(
    //   treasuryAirdropTx,
    //   "confirmed",
    // );
    // );
    const transferIx = web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: treasury.publicKey,
      lamports: amountToInitialize
    });

    const transaction = new web3.Transaction().add(transferIx);

    await web3.sendAndConfirmTransaction(program.provider.connection, transaction, [wallet]);

    const txHash = await clockworkProgram.methods
      .depositActionPoints()
      .accountsStrict({
        game: gameKey,
        player: playerKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .rpc();
   
    await program.provider.connection.confirmTransaction(txHash);
   
    const expectedActionPoints = 100 + 5 + 1; // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    const treasuryBalance = await program.provider.connection.getBalance(
      treasury.publicKey,
    );
    assert(
      treasuryBalance == amountToInitialize + expectedActionPoints, // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    );
   
    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));
   
    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));
  });
});