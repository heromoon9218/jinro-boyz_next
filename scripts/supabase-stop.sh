#!/usr/bin/env bash
# supabase stop + 旧イメージの自動クリーンアップ
# Usage: ./scripts/supabase-stop.sh

set -euo pipefail

PROJECT_ID="jinro-boyz_next"
SUFFIX="_${PROJECT_ID}"

echo "=== Supabase 停止中 (${PROJECT_ID}) ==="

# 現在使用中のイメージを記録
CURRENT_IMAGES=$(docker ps --filter "name=${SUFFIX}" --format "{{.Image}}" 2>/dev/null || true)

npx supabase stop

if [ -z "$CURRENT_IMAGES" ]; then
  echo "稼働中のコンテナがありませんでした。"
  exit 0
fi

echo ""
echo "=== 旧イメージのクリーンアップ ==="

# 停止後に残っている同名コンテナを削除
STOPPED=$(docker ps -a --filter "name=${SUFFIX}" --filter "status=exited" --format "{{.ID}}" 2>/dev/null || true)
if [ -n "$STOPPED" ]; then
  echo "停止済みコンテナを削除: $(echo "$STOPPED" | wc -l | tr -d ' ')個"
  echo "$STOPPED" | xargs docker rm || true
fi

# 使われていたイメージのうち、どのコンテナにも参照されていないものを削除
REMOVED=0
for IMAGE in $CURRENT_IMAGES; do
  # このイメージを使っているコンテナがまだあればスキップ
  REFS=$(docker ps -a --filter "ancestor=${IMAGE}" --format "{{.ID}}" 2>/dev/null || true)
  if [ -n "$REFS" ]; then
    continue
  fi

  echo "削除: ${IMAGE}"
  docker rmi "$IMAGE" 2>/dev/null && REMOVED=$((REMOVED + 1)) || true
done

# dangling イメージも掃除
# dangling は Repo/Tag が <none> のため reference フィルタと AND 併用すると一致せず常に空になる。
# Supabase 停止直後の未使用レイヤー回収のため、未使用 dangling を一括 prune（デフォルトは dangling のみ）。
echo "dangling イメージを prune"
docker image prune -f 2>/dev/null || true

echo ""
echo "=== 完了: ${REMOVED}個のイメージを削除しました ==="
