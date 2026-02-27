import { useState } from "react";
import type { StyleHistoryRecord } from "../../services/api/styleHistoryClient";
import styles from "./StyleHistoryList.module.css";

interface StyleHistoryListProps {
  history: StyleHistoryRecord[];
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
  onSelect: (record: StyleHistoryRecord) => void;
  onDelete: (id: string) => void;
}

export function StyleHistoryList({
  history,
  total,
  limit,
  offset,
  onPageChange,
  onSelect,
  onDelete,
}: StyleHistoryListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const handleDelete = (id: string) => {
    if (deleteConfirm === id) {
      onDelete(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Style History</h3>
        <span className={styles.total}>{total} records</span>
      </div>

      {history.length === 0 ? (
        <div className={styles.empty}>
          <p>No style analysis history yet.</p>
          <p>Start writing to build your style profile!</p>
        </div>
      ) : (
        <>
          <ul className={styles.list}>
            {history.map((record) => (
              <li key={record.id} className={styles.item}>
                <div className={styles.itemContent} onClick={() => onSelect(record)}>
                  <div className={styles.date}>{formatDate(record.created_at)}</div>
                  <div className={styles.text}>{truncateText(record.text)}</div>
                </div>
                <button
                  type="button"
                  className={`${styles.deleteButton} ${deleteConfirm === record.id ? styles.confirm : ""}`}
                  onClick={() => handleDelete(record.id)}
                  aria-label={deleteConfirm === record.id ? "Confirm delete" : "Delete"}
                >
                  {deleteConfirm === record.id ? "⚠️ Confirm?" : "🗑️"}
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => onPageChange(offset - limit)}
                className={styles.pageButton}
              >
                ← Previous
              </button>
              <span className={styles.pageInfo}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(offset + limit)}
                className={styles.pageButton}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
