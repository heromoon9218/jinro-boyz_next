#!/usr/bin/env bash
# supabase stop + 旧イメージの自動クリーンアップ
# Usage: ./scripts/supabase-stop.sh

set -euo pipefail

PROJECT_ID="jinro-boyz_next"
PREFIX="supabase_"
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
  echo "$STOPPED" | xargs docker rm
fi

# 使われていたイメージのうち、どのコンテナにも参照されていないものを削除
REMOVED=0
for IMAGE in $CURRENT_IMAGES; do
  REPO=$(echo "$IMAGE" | cut -d: -f1)
  TAG=$(echo "$IMAGE" | cut -d: -f2)

  # このイメージを使っているコンテナがまだあればスキップ
  REFS=$(docker ps -a --filter "ancestor=${IMAGE}" --format "{{.ID}}" 2>/dev/null || true)
  if [ -n "$REFS" ]; then
    continue
  fi

  echo "削除: ${IMAGE}"
  docker rmi "$IMAGE" 2>/dev/null && REMOVED=$((REMOVED + 1)) || true
done

# dangling イメージも掃除
DANGLING=$(docker images --filter "dangling=true" --filter "reference=public.ecr.aws/supabase/*" -q 2>/dev/null || true)
if [ -n "$DANGLING" ]; then
  echo "dangling イメージを削除"
  echo "$DANGLING" | xargs docker rmi 2>/dev/null || true
fi

echo ""
echo "=== 完了: ${REMOVED}個のイメージを削除しました ==="
