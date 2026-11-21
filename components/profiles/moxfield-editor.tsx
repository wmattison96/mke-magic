"use client";

import { useActionState, useState } from "react";
import { saveMoxfieldUrl, type MoxfieldActionState } from "@/app/profiles/actions";

const initialState: MoxfieldActionState = {};

export function MoxfieldEditor({ type, recordId, initialUrl, canEdit = false }: { type: "player" | "deck"; recordId: string; initialUrl: string | null; canEdit?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveMoxfieldUrl, initialState);
  return <div>
    {initialUrl && <a href={initialUrl} target="_blank" rel="noreferrer" className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800">Open Moxfield ↗</a>}
    {canEdit && <><button type="button" onClick={() => setOpen((value) => !value)} className="ml-2 text-[10px] font-medium text-slate-400 hover:text-indigo-700">{open ? "Close" : initialUrl ? "Edit link" : "Add Moxfield link"}</button>
    {open && <form action={action} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input type="hidden" name="type" value={type}/><input type="hidden" name="recordId" value={recordId}/>
      <label htmlFor={`moxfield-${recordId}`} className="block text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">Moxfield {type === "player" ? "profile" : "deck"} URL</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id={`moxfield-${recordId}`} type="url" name="moxfieldUrl" defaultValue={initialUrl ?? ""} placeholder={`https://moxfield.com/${type === "player" ? "users/your-name" : "decks/your-deck"}`} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"/><button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save link"}</button></div>
      <p className="mt-2 text-[9px] text-slate-400">Only an approved owner or administrator can change this link. Leave blank to remove it.</p>
      {state.error && <p role="alert" className="mt-2 text-[10px] text-rose-600">{state.error}</p>}{state.success && <p role="status" className="mt-2 text-[10px] text-emerald-700">{state.success}</p>}
    </form>}</>}
  </div>;
}
