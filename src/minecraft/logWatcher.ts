import fs from "node:fs";
import { Tail } from "tail";
import type { Config } from "../config.js";

export type ParsedEvent =
  | { type: "chat"; player: string; message: string }
  | { type: "join"; player: string }
  | { type: "leave"; player: string }
  | { type: "death"; player: string; message: string }
  | { type: "advancement"; player: string; advancement: string }
  | { type: "server"; event: "start" | "stop" }
  | { type: "console"; line: string };

// Common Paper / Vanilla log patterns (simplified, works for most recent versions)
const PATTERNS = {
  // [HH:MM:SS] [Server thread/INFO]: <Player> message
  chat: /\]: <([^>]+)> (.+)$/,
  // Player joined the game
  join: /\]: ([^\s]+) joined the game$/,
  leave: /\]: ([^\s]+) left the game$/,
  // Death messages are very varied; catch most "Player ..." lines that aren't join/leave/chat
  death: /\]: ([^\s]+) (was |died |drowned |burned |hit the ground|fell |tried to swim|discovered |got finished|experienced kinetic|didn't want to live|was squashed|was poked|was impaled|was skewered|was fireballed|was killed|starved|suffocated|was stung|was shot|withers? away|was doomed)/i,
  advancement: /\]: ([^\s]+) has (made the advancement|completed the challenge|reached the goal) \[(.+)\]$/,
  serverStart: /Done \([\d.]+s\)! For help, type "help"/,
  serverStop: /(Stopping the server|Server shutdown|Closing Server)/i,
};

export class LogWatcher {
  private tail: Tail | null = null;

  constructor(
    private readonly logFile: string,
    private readonly onEvent: (event: ParsedEvent) => void
  ) {}

  start(): void {
    if (!fs.existsSync(this.logFile)) {
      console.warn(`[LogWatcher] Log file not found yet: ${this.logFile}. Will retry when it appears.`);
    }

    this.tail = new Tail(this.logFile, {
      fromBeginning: false,
      follow: true,
      useWatchFile: true,
      fsWatchOptions: { interval: 500 },
    });

    this.tail.on("line", (line: string) => this.handleLine(line));
    this.tail.on("error", (err: Error) => {
      console.error("[LogWatcher] Error:", err.message);
    });

    console.log(`[LogWatcher] Watching ${this.logFile}`);
  }

  stop(): void {
    this.tail?.unwatch();
    this.tail = null;
  }

  private handleLine(line: string): void {
    // Always emit raw console line if someone is listening for it
    this.onEvent({ type: "console", line });

    let match: RegExpMatchArray | null;

    if ((match = line.match(PATTERNS.chat))) {
      this.onEvent({ type: "chat", player: match[1], message: match[2] });
      return;
    }
    if ((match = line.match(PATTERNS.join))) {
      this.onEvent({ type: "join", player: match[1] });
      return;
    }
    if ((match = line.match(PATTERNS.leave))) {
      this.onEvent({ type: "leave", player: match[1] });
      return;
    }
    if ((match = line.match(PATTERNS.advancement))) {
      this.onEvent({
        type: "advancement",
        player: match[1],
        advancement: match[3],
      });
      return;
    }
    if ((match = line.match(PATTERNS.death))) {
      // Reconstruct a readable death message
      const player = match[1];
      const rest = line.split(`]: ${player} `)[1] ?? line;
      this.onEvent({ type: "death", player, message: `${player} ${rest}` });
      return;
    }
    if (PATTERNS.serverStart.test(line)) {
      this.onEvent({ type: "server", event: "start" });
      return;
    }
    if (PATTERNS.serverStop.test(line)) {
      this.onEvent({ type: "server", event: "stop" });
      return;
    }
  }
}
