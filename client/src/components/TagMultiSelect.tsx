import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";

type TagOption = { id: number; name: string };

export function TagMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = "Selecionar…",
  onCreate,
}: {
  label: string;
  options: TagOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  /** When set, typing a name with no match offers a "Criar…" option. */
  onCreate?: (name: string) => Promise<TagOption | null>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = options.filter((option) => selectedIds.includes(option.id));

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]);
  }

  const trimmed = search.trim();
  const hasExactMatch = options.some((option) => option.name.toLowerCase() === trimmed.toLowerCase());
  const canCreate = Boolean(onCreate) && trimmed.length >= 2 && !hasExactMatch;

  async function handleCreate() {
    if (!onCreate || creating || !trimmed) return;
    setCreating(true);
    try {
      const created = await onCreate(trimmed);
      if (created) {
        onChange([...selectedIds, created.id]);
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="mt-3 flex min-h-10 w-full flex-wrap items-center gap-1.5 border border-black px-3 py-2 text-left text-sm">
            {selected.length ? (
              selected.map((option) => (
                <span key={option.id} className="inline-flex items-center gap-1 border border-black bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold">
                  {option.name}
                  <X
                    size={12}
                    className="cursor-pointer hover:text-[#f0372f]"
                    onClick={(event) => { event.stopPropagation(); toggle(option.id); }}
                  />
                </span>
              ))
            ) : (
              <span className="text-neutral-400">{placeholder}</span>
            )}
            <ChevronDown size={14} className="ml-auto shrink-0 text-neutral-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] rounded-none border-black p-0">
          <Command shouldFilter={!onCreate}>
            <CommandInput placeholder="Pesquisar…" className="text-sm" value={search} onValueChange={setSearch} />
            <CommandList>
              {!canCreate && <CommandEmpty>Sem resultados.</CommandEmpty>}
              <CommandGroup>
                {(onCreate ? options.filter((option) => option.name.toLowerCase().includes(trimmed.toLowerCase())) : options).map((option) => (
                  <CommandItem key={option.id} value={option.name} onSelect={() => toggle(option.id)} className="rounded-none">
                    <Checkbox checked={selectedIds.includes(option.id)} className="mr-2 rounded-none" />
                    {option.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreate && (
                <CommandGroup>
                  <CommandItem onSelect={() => void handleCreate()} disabled={creating} className="rounded-none font-semibold">
                    <Plus size={13} className="mr-2" /> {creating ? "A criar…" : `Criar "${trimmed}"`}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
