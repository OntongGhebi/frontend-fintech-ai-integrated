import { useMemo, useState } from "react";
import {
  Activity,
  Baby,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Car,
  ChartNoAxesCombined,
  Coffee,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Laptop,
  Music,
  PawPrint,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Tag,
  TrainFront,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import "./CategoryIconPicker.css";

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Baby,
  Bike,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  Car,
  ChartNoAxesCombined,
  Coffee,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Laptop,
  Music,
  PawPrint,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Tag,
  TrainFront,
  TrendingUp,
  Utensils,
  Wallet,
  Wrench,
  Zap,
};

const ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: "Utensils", label: "Makanan", Icon: Utensils },
  { name: "Coffee", label: "Kopi", Icon: Coffee },
  { name: "ShoppingCart", label: "Belanja", Icon: ShoppingCart },
  { name: "ShoppingBag", label: "Tas belanja", Icon: ShoppingBag },
  { name: "Car", label: "Mobil", Icon: Car },
  { name: "Bike", label: "Sepeda", Icon: Bike },
  { name: "Bus", label: "Bus", Icon: Bus },
  { name: "TrainFront", label: "Kereta", Icon: TrainFront },
  { name: "Plane", label: "Pesawat", Icon: Plane },
  { name: "House", label: "Rumah", Icon: House },
  { name: "Zap", label: "Listrik", Icon: Zap },
  { name: "Smartphone", label: "Telepon", Icon: Smartphone },
  { name: "Laptop", label: "Laptop", Icon: Laptop },
  { name: "Heart", label: "Kesehatan", Icon: Heart },
  { name: "HeartPulse", label: "Medis", Icon: HeartPulse },
  { name: "Stethoscope", label: "Dokter", Icon: Stethoscope },
  { name: "GraduationCap", label: "Pendidikan", Icon: GraduationCap },
  { name: "BookOpen", label: "Buku", Icon: BookOpen },
  { name: "BriefcaseBusiness", label: "Pekerjaan", Icon: BriefcaseBusiness },
  { name: "TrendingUp", label: "Investasi", Icon: TrendingUp },
  {
    name: "ChartNoAxesCombined",
    label: "Pendapatan",
    Icon: ChartNoAxesCombined,
  },
  { name: "Wallet", label: "Keuangan", Icon: Wallet },
  { name: "Gift", label: "Hadiah", Icon: Gift },
  { name: "Film", label: "Film", Icon: Film },
  { name: "Music", label: "Musik", Icon: Music },
  { name: "Gamepad2", label: "Permainan", Icon: Gamepad2 },
  { name: "Dumbbell", label: "Olahraga", Icon: Dumbbell },
  { name: "PawPrint", label: "Hewan peliharaan", Icon: PawPrint },
  { name: "Baby", label: "Anak", Icon: Baby },
  { name: "Sparkles", label: "Perawatan", Icon: Sparkles },
  { name: "Wrench", label: "Perbaikan", Icon: Wrench },
  { name: "Activity", label: "Aktivitas", Icon: Activity },
  { name: "Tag", label: "Lainnya", Icon: Tag },
];

interface CategoryIconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategoryIconPicker({
  value,
  onChange,
}: CategoryIconPickerProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const selectedIcon = CATEGORY_ICON_MAP[value];
  const SelectedIcon = selectedIcon ?? Tag;

  const visibleIcons = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");

    if (!normalized) {
      return ICONS;
    }

    return ICONS.filter(
      ({ name, label }) =>
        name.toLocaleLowerCase("id-ID").includes(normalized) ||
        label.toLocaleLowerCase("id-ID").includes(normalized),
    );
  }, [query]);

  return (
    <div className="category-icon-picker">
      <span className="category-icon-picker-label">Pilih ikon kategori</span>

      <button
        type="button"
        className="category-icon-current"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-label="Buka katalog ikon kategori"
      >
        <span className="category-icon-current-preview">
          <SelectedIcon size={23} strokeWidth={1.8} />
        </span>
        <span className="category-icon-current-text">
          <strong>{value || "Tag"}</strong>
          <small>
            {ICONS.find((item) => item.name === value)?.label ??
              "Pilih ikon yang sesuai"}
          </small>
        </span>
        <span className="category-icon-current-action">
          {expanded ? "Tutup" : "Ganti ikon"}
        </span>
      </button>

      {expanded && (
        <div className="category-icon-catalog">
          <label className="category-icon-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari ikon, misalnya makanan..."
              aria-label="Cari ikon kategori"
            />
          </label>

          <div className="category-icon-grid">
            {visibleIcons.map(({ name, label, Icon }) => {
              const selected = value === name;

              return (
                <button
                  key={name}
                  type="button"
                  className={`category-icon-option ${
                    selected ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    onChange(name);
                    setExpanded(false);
                    setQuery("");
                  }}
                  aria-pressed={selected}
                  title={label}
                >
                  <Icon size={22} strokeWidth={1.8} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {visibleIcons.length === 0 && (
            <p className="category-icon-empty">
              Ikon tidak ditemukan. Coba kata kunci lain.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
