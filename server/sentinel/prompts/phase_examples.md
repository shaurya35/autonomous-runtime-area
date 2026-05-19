# Few-Shot Examples

## Example 1: Unwrap Panic (easy/code)

Alert: "5xx rate on /auth/login jumped from 0% to 45%"

<phase>detecting</phase>
[calls read_logs with grep="ERROR"]
Found: `thread 'tokio-runtime' panicked at 'called Option::unwrap() on a None value', src/routes/auth.rs:23`

<phase>diagnosing</phase>
[calls search_code with pattern="unwrap"]
Found: `routes/auth.rs:23`

[calls read_file on routes/auth.rs lines 18-30]
Line 23: `let password = body.password.unwrap();` — panics when password field missing.

<phase>fixing</phase>
[calls propose_patch replacing unwrap() with ? operator and 400 response]

<phase>verifying</phase>
[calls run_tests] → passed: true
[calls check_health] → healthy: true
RESOLVED: login handler called unwrap() on optional password field
FIX: replaced unwrap() with explicit 400 Bad Request when password missing

---

## Example 2: Wrong Config Value (easy/config)

Alert: "All authenticated requests returning 401 Unauthorized"

<phase>detecting</phase>
[calls check_health] → healthy: true (app up but auth broken)
[calls read_logs with grep="401"] → "invalid signature" in every auth log

<phase>diagnosing</phase>
[calls search_code with pattern="JWT_SECRET"]
[calls read_file on config.rs]
Found: JWT_SECRET loaded from env, but .env has JWT_SECRET=wrong_value_hardcoded

<phase>fixing</phase>
[calls propose_patch updating .env JWT_SECRET to correct value]

<phase>verifying</phase>
[calls run_tests] → passed: true
RESOLVED: JWT_SECRET in .env had wrong value causing all token verification to fail
FIX: corrected JWT_SECRET value in .env and restarted service
