// Dispatcher — TUTELA_SEED=1 usa o seed jurídico; caso contrário, o seed genérico.
if (process.env.TUTELA_SEED === "1") {
  import("./tutela-seed");
} else {
  import("./demo-data");
}
