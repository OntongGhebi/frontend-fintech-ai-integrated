import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Archive,
  Check,
  ChevronDown,
  CircleAlert,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
} from "lucide-react";
import {
  CATEGORY_ICON_MAP,
  CategoryIconPicker,
} from "../components/categories/CategoryIconPicker";

import { ApiRequestError, apiClient } from "../lib/api-client";
import "./CategoriesPage.css";

type CategoryType = "INCOME" | "EXPENSE";
type CategoryFilter = "ALL" | CategoryType;
type FormMode = "create" | "edit";

interface Category {
  id: string;
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ApiEnvelope<T> {
  data: T;
}

interface CategoryForm {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

const EMPTY_FORM: CategoryForm = {
  name: "",
  type: "EXPENSE",
  icon: "",
  color: "#24785B",
};

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "EXPENSE", label: "Pengeluaran" },
  { value: "INCOME", label: "Pemasukan" },
];

function unwrapData<T>(response: T | ApiEnvelope<T>): T {
  if (typeof response === "object" && response !== null && "data" in response) {
    return (response as ApiEnvelope<T>).data;
  }

  return response as T;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 400) {
      return `Data tidak valid. Periksa kembali input Anda. ${error.message}`;
    }

    if (error.status === 403) {
      return "Kategori sistem tidak dapat diubah atau diarsipkan.";
    }

    if (error.status === 404) {
      return "Kategori tidak ditemukan atau sudah diarsipkan. Muat ulang daftar.";
    }

    if (error.status === 409) {
      return "Nama kategori tersebut sudah digunakan. Gunakan nama lain.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi kesalahan. Silakan coba kembali.";
}

function getTypeLabel(type: CategoryType): string {
  return type === "INCOME" ? "Pemasukan" : "Pengeluaran";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CategoryFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [categoryToArchive, setCategoryToArchive] = useState<Category | null>(
    null,
  );
  const [archiving, setArchiving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const query =
        typeFilter === "ALL" ? "" : `?type=${encodeURIComponent(typeFilter)}`;

      const response = await apiClient.get<
        Category[] | ApiEnvelope<Category[]>
      >(`categories${query}`);

      const result = unwrapData(response);
      setCategories(Array.isArray(result) ? result : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const filteredCategories = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("id-ID");

    return categories.filter((category) => {
      if (!category.isActive) {
        return false;
      }

      return (
        normalizedSearch.length === 0 ||
        category.name.toLocaleLowerCase("id-ID").includes(normalizedSearch) ||
        getTypeLabel(category.type)
          .toLocaleLowerCase("id-ID")
          .includes(normalizedSearch)
      );
    });
  }, [categories, search]);

  const activeCategories = useMemo(
    () => categories.filter((category) => category.isActive),
    [categories],
  );

  const incomeCount = useMemo(
    () =>
      activeCategories.filter((category) => category.type === "INCOME").length,
    [activeCategories],
  );

  const expenseCount = useMemo(
    () =>
      activeCategories.filter((category) => category.type === "EXPENSE").length,
    [activeCategories],
  );

  function openCreateForm() {
    setFormMode("create");
    setEditingCategoryId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function openEditForm(category: Category) {
    if (category.isSystem) {
      return;
    }

    setFormMode("edit");
    setEditingCategoryId(category.id);
    setForm({
      name: category.name,
      type: category.type,
      icon: category.icon ?? "",
      color: category.color ?? "#24785B",
    });
    setFormError("");
    setNotice("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(false);
    setEditingCategoryId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function updateForm<K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setNotice("");

    const name = form.name.trim();
    const icon = form.icon.trim();
    const color = form.color.trim();

    if (!name || name.length > 100) {
      setFormError("Nama kategori wajib diisi, maksimal 100 karakter.");
      return;
    }

    if (icon.length > 50) {
      setFormError("Nama ikon maksimal 50 karakter.");
      return;
    }

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setFormError("Warna harus menggunakan format hex, contoh #24785B.");
      return;
    }

    if (formMode === "edit" && !editingCategoryId) {
      setFormError("Kategori yang akan diubah tidak valid.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name,
        type: form.type,
        icon: icon || "Tag",
        color: color || "#24785B",
      };

      if (formMode === "create") {
        await apiClient.post("categories", payload);
        setNotice("Kategori berhasil ditambahkan.");
      } else {
        await apiClient.patch(
          `categories/${encodeURIComponent(editingCategoryId!)}`,
          payload,
        );
        setNotice("Kategori berhasil diperbarui.");
      }

      setFormOpen(false);
      setEditingCategoryId(null);
      setForm(EMPTY_FORM);
      await loadCategories();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!categoryToArchive || archiving) {
      return;
    }

    setArchiving(true);
    setPageError("");
    setNotice("");

    try {
      await apiClient.delete(
        `categories/${encodeURIComponent(categoryToArchive.id)}`,
      );

      setNotice(`Kategori "${categoryToArchive.name}" berhasil diarsipkan.`);
      setCategoryToArchive(null);
      await loadCategories();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setArchiving(false);
    }
  }

  return (
    <section className="categories-page">
      <div className="categories-page-heading">
        <div>
          <p className="categories-eyebrow">PENGELOLAAN KEUANGAN</p>
          <h2>Kategori</h2>
          <p>
            Atur kategori untuk membantu mengelompokkan pemasukan dan
            pengeluaran transaksi Anda.
          </p>
        </div>

        <button
          type="button"
          className="categories-button categories-button-primary"
          onClick={openCreateForm}
        >
          <Plus size={17} />
          <span>Tambah kategori</span>
        </button>
      </div>

      <div className="categories-summary">
        <article className="categories-summary-card">
          <span className="categories-summary-icon categories-icon-neutral">
            <Tag size={18} />
          </span>
          <div>
            <span>Total kategori aktif</span>
            <strong>{activeCategories.length}</strong>
          </div>
        </article>

        <article className="categories-summary-card">
          <span className="categories-summary-icon categories-icon-income">
            <Check size={18} />
          </span>
          <div>
            <span>Kategori pemasukan</span>
            <strong>{incomeCount}</strong>
          </div>
        </article>

        <article className="categories-summary-card">
          <span className="categories-summary-icon categories-icon-expense">
            <Archive size={18} />
          </span>
          <div>
            <span>Kategori pengeluaran</span>
            <strong>{expenseCount}</strong>
          </div>
        </article>
      </div>

      {notice && (
        <div
          className="categories-feedback categories-feedback-success"
          role="status"
        >
          <Check size={17} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Tutup pesan"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {pageError && (
        <div
          className="categories-feedback categories-feedback-error"
          role="alert"
        >
          <CircleAlert size={17} />
          <span>{pageError}</span>
          <button
            type="button"
            className="categories-feedback-retry"
            onClick={() => void loadCategories()}
            disabled={loading}
          >
            Coba lagi
          </button>
        </div>
      )}

      <div className="categories-toolbar">
        <label className="categories-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kategori..."
            aria-label="Cari kategori"
          />
        </label>

        <label className="categories-filter">
          <span>Jenis kategori</span>
          <span className="categories-select-wrap">
            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as CategoryFilter)
              }
              aria-label="Filter jenis kategori"
            >
              <option value="ALL">Semua jenis</option>
              <option value="INCOME">Pemasukan</option>
              <option value="EXPENSE">Pengeluaran</option>
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </label>

        <button
          type="button"
          className="categories-button categories-button-secondary categories-refresh"
          onClick={() => void loadCategories()}
          disabled={loading}
        >
          <RefreshCw
            size={15}
            className={loading ? "categories-spinning" : ""}
          />
          <span>Muat ulang</span>
        </button>
      </div>

      <div className="categories-list-card">
        <div className="categories-list-heading">
          <div>
            <h3>Daftar kategori</h3>
            <p>
              {loading
                ? "Mengambil data kategori..."
                : `${filteredCategories.length} kategori ditampilkan`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="categories-state">
            <LoaderCircle size={25} className="categories-spinning" />
            <p>Memuat kategori...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="categories-state">
            <span className="categories-empty-icon">
              <Tag size={24} />
            </span>
            <h3>
              {search.trim()
                ? "Kategori tidak ditemukan"
                : "Belum ada kategori"}
            </h3>
            <p>
              {search.trim()
                ? "Coba kata kunci lain atau ubah filter jenis kategori."
                : "Tambahkan kategori agar transaksi lebih mudah dikelola."}
            </p>
            {!search.trim() && (
              <button
                type="button"
                className="categories-button categories-button-primary"
                onClick={openCreateForm}
              >
                <Plus size={16} />
                Tambah kategori
              </button>
            )}
          </div>
        ) : (
          <div className="categories-table-wrap">
            <table className="categories-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Jenis</th>
                  <th>Status</th>
                  <th>Diperbarui</th>
                  <th className="categories-actions-heading">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="categories-name-cell">
                        <span
                          className="categories-real-icon"
                          style={{
                            color:
                              category.color &&
                              /^#[0-9A-Fa-f]{6}$/.test(category.color)
                                ? category.color
                                : "#24785B",
                          }}
                          aria-hidden="true"
                        >
                          {(() => {
                            const Icon =
                              CATEGORY_ICON_MAP[category.icon ?? ""] ??
                              CATEGORY_ICON_MAP.Tag ??
                              Tag;

                            return <Icon size={20} strokeWidth={1.8} />;
                          })()}
                        </span>

                        <div>
                          <strong>{category.name}</strong>
                          <span>
                            {CATEGORY_ICON_MAP[category.icon ?? ""]
                              ? `Ikon: ${category.icon}`
                              : "Ikon kategori umum"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`categories-type-badge ${
                          category.type === "INCOME"
                            ? "categories-type-income"
                            : "categories-type-expense"
                        }`}
                      >
                        {getTypeLabel(category.type)}
                      </span>
                    </td>
                    <td>
                      {category.isSystem ? (
                        <span className="categories-system-badge">Sistem</span>
                      ) : (
                        <span className="categories-custom-badge">Kustom</span>
                      )}
                    </td>
                    <td className="categories-date">
                      {formatDate(category.updatedAt)}
                    </td>
                    <td>
                      <div className="categories-row-actions">
                        <button
                          type="button"
                          className="categories-row-action"
                          title={
                            category.isSystem
                              ? "Kategori sistem tidak dapat diedit"
                              : "Edit kategori"
                          }
                          aria-label={`Edit kategori ${category.name}`}
                          disabled={category.isSystem}
                          onClick={() => openEditForm(category)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="categories-row-action categories-row-action-danger"
                          title={
                            category.isSystem
                              ? "Kategori sistem tidak dapat diarsipkan"
                              : "Arsipkan kategori"
                          }
                          aria-label={`Arsipkan kategori ${category.name}`}
                          disabled={category.isSystem}
                          onClick={() => setCategoryToArchive(category)}
                        >
                          <Archive size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div
          className="categories-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeForm();
            }
          }}
        >
          <section
            className="categories-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="categories-form-title"
          >
            <div className="categories-modal-heading">
              <div>
                <p className="categories-eyebrow">
                  {formMode === "create"
                    ? "KATEGORI BARU"
                    : "PERBARUI KATEGORI"}
                </p>
                <h3 id="categories-form-title">
                  {formMode === "create" ? "Tambah kategori" : "Edit kategori"}
                </h3>
                <p>
                  Gunakan nama yang jelas agar transaksi mudah dikelompokkan.
                </p>
              </div>
              <button
                type="button"
                className="categories-modal-close"
                aria-label="Tutup formulir"
                onClick={closeForm}
                disabled={saving}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)}>
              {formError && (
                <div
                  className="categories-feedback categories-feedback-error"
                  role="alert"
                >
                  <CircleAlert size={17} />
                  <span>{formError}</span>
                </div>
              )}

              <label className="categories-form-field">
                <span>
                  Nama kategori <b>*</b>
                </span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  maxLength={100}
                  required
                  placeholder="Contoh: Makan dan minum"
                />
                <small>{form.name.length}/100 karakter</small>
              </label>

              <label className="categories-form-field">
                <span>
                  Jenis kategori <b>*</b>
                </span>
                <select
                  value={form.type}
                  onChange={(event) =>
                    updateForm("type", event.target.value as CategoryType)
                  }
                  required
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {formMode === "edit" && (
                  <small>
                    Perubahan jenis kategori mengikuti aturan backend dan
                    validasi transaksi terkait.
                  </small>
                )}
              </label>

              <div className="categories-form-field">
                <span>
                  Identitas ikon <small>(opsional)</small>
                </span>

                <CategoryIconPicker
                  value={form.icon || "Tag"}
                  onChange={(iconName) => updateForm("icon", iconName)}
                />

                <small>
                  Pilih ikon yang paling sesuai dengan kategori. Ikon akan
                  ditampilkan pada daftar kategori dan disimpan sebagai nama
                  ikon.
                </small>
              </div>

              <label className="categories-form-field">
                <span>Warna kategori</span>
                <div className="categories-color-input">
                  <input
                    type="color"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(form.color)
                        ? form.color
                        : "#24785B"
                    }
                    onChange={(event) =>
                      updateForm("color", event.target.value.toUpperCase())
                    }
                    aria-label="Pilih warna kategori"
                  />
                  <input
                    value={form.color}
                    onChange={(event) =>
                      updateForm("color", event.target.value)
                    }
                    maxLength={20}
                    placeholder="#24785B"
                    aria-label="Kode warna hex"
                  />
                </div>
                <small>Format warna: #RRGGBB.</small>
              </label>

              <div className="categories-modal-actions">
                <button
                  type="button"
                  className="categories-button categories-button-secondary"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="categories-button categories-button-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle size={16} className="categories-spinning" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>
                    {saving
                      ? "Menyimpan..."
                      : formMode === "create"
                        ? "Simpan kategori"
                        : "Simpan perubahan"}
                  </span>
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {categoryToArchive && (
        <div className="categories-modal-backdrop">
          <section
            className="categories-modal categories-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="categories-archive-title"
          >
            <span className="categories-confirm-icon">
              <Archive size={22} />
            </span>
            <h3 id="categories-archive-title">Arsipkan kategori?</h3>
            <p>
              Kategori <strong>{categoryToArchive.name}</strong> akan
              dinonaktifkan dan tidak ditampilkan dalam daftar kategori aktif.
              Tindakan ini bukan penghapusan permanen.
            </p>
            {pageError && (
              <div
                className="categories-feedback categories-feedback-error"
                role="alert"
              >
                <CircleAlert size={17} />
                <span>{pageError}</span>
              </div>
            )}
            <div className="categories-modal-actions">
              <button
                type="button"
                className="categories-button categories-button-secondary"
                onClick={() => setCategoryToArchive(null)}
                disabled={archiving}
              >
                Batal
              </button>
              <button
                type="button"
                className="categories-button categories-button-danger"
                onClick={() => void handleArchive()}
                disabled={archiving}
              >
                {archiving && (
                  <LoaderCircle size={16} className="categories-spinning" />
                )}
                <span>{archiving ? "Mengarsipkan..." : "Ya, arsipkan"}</span>
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
