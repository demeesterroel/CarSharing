import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { applyCreate, replaceCreate, rollbackCreate, applyUpdate, applyDelete } from "./optimistic";

interface Trip {
  id: number;
  client_id?: string | null;
  amount: number;
}

describe("optimistic helpers", () => {
  it("applyCreate inserts a pending row at the start of the list", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: 1, amount: 5 }]);
    applyCreate<Trip>(qc, ["trips"], { id: -123, client_id: "u-1", amount: 10 });
    const list = qc.getQueryData<Trip[]>(["trips"])!;
    expect(list).toHaveLength(2);
    expect(list[0].client_id).toBe("u-1");
  });

  it("replaceCreate swaps the pending row for the server row", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: -123, client_id: "u-1", amount: 10 }]);
    replaceCreate<Trip>(qc, ["trips"], "u-1", { id: 999, client_id: "u-1", amount: 10 });
    const list = qc.getQueryData<Trip[]>(["trips"])!;
    expect(list[0].id).toBe(999);
  });

  it("rollbackCreate removes the pending row by client_id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: -123, client_id: "u-1", amount: 10 }]);
    rollbackCreate<Trip>(qc, ["trips"], "u-1");
    expect(qc.getQueryData<Trip[]>(["trips"])).toHaveLength(0);
  });

  it("applyUpdate patches an existing row by id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: 1, amount: 5 }]);
    applyUpdate<Trip>(qc, ["trips"], 1, { amount: 7 });
    expect(qc.getQueryData<Trip[]>(["trips"])![0].amount).toBe(7);
  });

  it("applyDelete removes a row by id", () => {
    const qc = new QueryClient();
    qc.setQueryData<Trip[]>(["trips"], [{ id: 1, amount: 5 }]);
    applyDelete<Trip>(qc, ["trips"], 1);
    expect(qc.getQueryData<Trip[]>(["trips"])).toHaveLength(0);
  });
});
