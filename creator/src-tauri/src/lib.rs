// EnZIME Creator — library entry point. Bootstrap stub.
//
// Real run() implementation, AppState wiring, command surface, etc.
// will be authored by the Creator app's dedicated architect session
// (see ./CHECKLIST.md Phase Creator-1+).

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn run() {
    // Bootstrap stub. Real Tauri shell wiring pending.
    eprintln!("EnZIME Creator v{} — bootstrap stub; run() not yet implemented", version());
    eprintln!("See creator/ARCHITECTURE.md and creator/CHECKLIST.md for next steps.");
}
