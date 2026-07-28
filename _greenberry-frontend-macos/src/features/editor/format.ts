// Lightweight SQL formatter (S5.3): uppercase keywords, newline before major
// clauses. Idempotent (collapses whitespace then re-lays-out deterministically).
const KEYWORD_RE =
  /\b(select|from|where|and|or|on|as|not|null|group by|order by|having|limit|offset|left join|right join|inner join|join|insert into|values|update|set|delete from|distinct|asc|desc|union all|union|inner|left|right|outer|is|in|like|ilike)\b/gi;

const CLAUSE_RE =
  /\b(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|LEFT JOIN|RIGHT JOIN|INNER JOIN|JOIN|UNION ALL|UNION|VALUES|SET)\b/g;

export function formatSql(sql: string): string {
  let s = sql
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*;\s*$/, "");
  s = s.replace(KEYWORD_RE, (m) => m.toUpperCase());
  s = s.replace(CLAUSE_RE, "\n$1");
  s = s.replace(/ +\n/g, "\n"); // drop the space before an inserted newline
  return s.trim();
}
