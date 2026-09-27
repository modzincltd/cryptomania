import "dotenv/config";
import { startEngine } from "./runner";
startEngine();
process.on("SIGINT", () => { console.log("engine stopping"); process.exit(0); });
process.on("SIGTERM", () => process.exit(0));
