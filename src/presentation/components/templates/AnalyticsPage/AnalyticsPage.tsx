import { cx } from "../../../utils/component.helpers.ts";
import styles from "./AnalyticsPage.module.css";
import type { AnalyticsPageProps } from "./AnalyticsPage.types.ts";

export function AnalyticsPage({
  children,
  className,
  description,
  eyebrow = "Observatorio financiero",
  introAction,
  notice,
  title,
  ...props
}: AnalyticsPageProps) {
  return (
    <>
      <title>{`${title} · My Expenses`}</title>
      <section {...props} className={cx(styles.page, className)}>
        <div className={styles.intro}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>
          <div className={styles.introMeta}>
            {notice === undefined ? null : (
              <span aria-live="polite" className={styles.notice}>
                {notice}
              </span>
            )}
            {introAction}
          </div>
        </div>
        {children}
      </section>
    </>
  );
}
