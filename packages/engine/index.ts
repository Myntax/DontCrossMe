// Public surface of the deterministic engine. This module never imports the DB
// or the AI layer — it operates purely on the plain data structures below, which
// is exactly what lets every feature work with AI fully disabled.

export * from "./enums";
export * from "./evidence";
export * from "./taxonomy";
export * from "./viability";
export * from "./culture";
export * from "./interventions";
