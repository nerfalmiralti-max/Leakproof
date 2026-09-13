"use client";
import { useState } from "react";
import { setDispatcherKey } from "@/lib/reports/remote-repository";

export function DispatcherAccess({ onChange }: { onChange: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  function save(value: string) {
    try {
      setDispatcherKey(value);
      setKey("");
      setError("");
      onChange();
    } catch {
      setError(
        "Session storage is unavailable. Enable it to unlock this workspace.",
      );
    }
  }
  return (
    <form
      className="panel my-4 flex flex-wrap items-end gap-3 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save(key.trim());
      }}
    >
      <div className="min-w-48 flex-1">
        <label
          htmlFor="dispatcher-key"
          className="mb-1 block text-xs font-semibold"
        >
          Dispatcher access key
        </label>
        <input
          id="dispatcher-key"
          type="password"
          autoComplete="off"
          className="field"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Enter key to load shared reports"
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={!key.trim()}>
        Unlock workspace
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => save("")}
      >
        Lock workspace
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
