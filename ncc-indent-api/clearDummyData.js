import { pool } from "./src/db/pool.js"; // Adjust path if needed

const clearDummyData = async () => {
  try {
    console.log("🧹 Deleting dummy employees...");

    // This deletes everyone EXCEPT the 'admin' account
    const result = await pool.query(`
            DELETE FROM users 
            WHERE login_name != 'admin';
        `);

    console.log(`✅ Success! Deleted ${result.rowCount} dummy users.`);
    console.log("🛡️ The Admin account is safe and ready to use.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error clearing data:", error);
    process.exit(1);
  }
};

clearDummyData();
