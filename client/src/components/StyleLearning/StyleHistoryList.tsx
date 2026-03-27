import { useState, useEffect } from "react";
import type { StyleHistoryRecord } from "../../hooks/useStyleHistory";
import { useStyleHistory } from "../../hooks/useStyleHistory";
import styles from "./StyleHistoryList.module.css";

interface StyleHistoryListProps {
  userId: string;
  onSelect: (record: StyleHistoryRecord) => void;
}

export function StyleHistoryList({ userId, onSelect }: StyleHistoryListProps): JSX.Element {
  const { history, total, loading, error, fetchHistory, remove } = useStyleHistory();
  const [offset, setOffset] = useState(0);
  const limit: number = 10;
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch history on mount and when dependencies change
  useEffect(() => {
    fetchHistory(userId, limit, offset);
  }, [userId, limit, offset, fetchHistory]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength = 100): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (deleteConfirm === id) {
      const success = await remove(id);
      if (success) {
        setDeleteConfirm(null);
      }
    } else {
      setDeleteConfirm(id);
    }
  };

  const handlePageChange = (newOffset: number): void => {
    setOffset(newOffset);
    fetchHistory(userId, limit, newOffset);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Style History</h3>
        <span className={styles.total}>{total} records</span>
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && history.length === 0 ? (
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
                onClick={() => handlePageChange(offset - limit)}
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
                onClick={() => handlePageChange(offset + limit)}
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
