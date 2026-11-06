export const visibleProgrammesSQL = `WITH RECURSIVE visible AS (
      SELECT id,kind,parent_id,title,description,sort_order FROM content_nodes WHERE parent_id IS NULL AND kind='division' AND status='published'
      UNION ALL SELECT n.id,n.kind,n.parent_id,n.title,n.description,n.sort_order FROM content_nodes n JOIN visible p ON n.parent_id=p.id WHERE n.status='published'
    )`;
