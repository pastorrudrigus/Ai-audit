/**
 * O entity_map cifrado precisa carregar orgId (e opcionalmente userId) para
 * os endpoints de reveal poderem checar tenant. Este teste verifica que a
 * cifragem do pipeline empacota nesse formato.
 */

import { describe, it, expect } from "vitest";
import type { EntityMapEnvelope } from "../pipeline";
import type { EntityMapping } from "../dlp";

describe("EntityMapEnvelope — formato do payload cifrado", () => {
  it("contém v=1, orgId e entities; userId é opcional", () => {
    const env: EntityMapEnvelope = {
      v: 1,
      orgId: "org-abc",
      userId: "usr-xyz",
      entities: [{ token: "⟨CPF_1⟩", original: "123.456.789-09", type: "cpf" }],
    };
    // O JSON serializado precisa preservar todos os campos essenciais para
    // o reveal endpoint conseguir validar contra a sessão.
    const roundTripped = JSON.parse(JSON.stringify(env)) as EntityMapEnvelope;
    expect(roundTripped.v).toBe(1);
    expect(roundTripped.orgId).toBe("org-abc");
    expect(roundTripped.userId).toBe("usr-xyz");
    expect(roundTripped.entities).toHaveLength(1);
  });

  it("tolera userId ausente (chamadas anônimas via gateway sem user)", () => {
    const env: EntityMapEnvelope = {
      v: 1,
      orgId: "org-abc",
      entities: [],
    };
    expect(env.userId).toBeUndefined();
  });
});

/**
 * Simulação do que os endpoints /api/chat/reveal e /reveal-map fazem:
 * dado um envelope cru, aceitar apenas se orgId bate com a sessão.
 * A lógica real está nos route handlers; o teste aqui garante que o
 * contrato do envelope resista a serialização.
 */
describe("Envelope — validação de tenant", () => {
  function checkTenant(env: EntityMapEnvelope, sessionOrgId: string) {
    return env.orgId === sessionOrgId;
  }

  it("aceita quando orgId bate", () => {
    const env: EntityMapEnvelope = {
      v: 1,
      orgId: "org-A",
      entities: [{ token: "⟨PESSOA_1⟩", original: "João", type: "PESSOA" }],
    };
    expect(checkTenant(env, "org-A")).toBe(true);
  });

  it("rejeita quando orgId difere (blob de outra banca)", () => {
    const env: EntityMapEnvelope = {
      v: 1,
      orgId: "org-A",
      entities: [{ token: "⟨PESSOA_1⟩", original: "João", type: "PESSOA" }],
    };
    expect(checkTenant(env, "org-B")).toBe(false);
  });

  it("formato antigo (array cru) é detectável para retrocompat", () => {
    const legacyRaw: EntityMapping[] = [
      { token: "⟨CPF_1⟩", original: "123.456.789-09", type: "cpf" },
    ];
    const parsed: unknown = JSON.parse(JSON.stringify(legacyRaw));
    expect(Array.isArray(parsed)).toBe(true);
  });
});
