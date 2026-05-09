#!/usr/bin/env sh
set -eu

BUCKET="${S3_BUCKET:-attachments}"
KEY_NAME="${GARAGE_KEY_NAME:-ameo-app}"
ACCESS_KEY="${S3_ACCESS_KEY:-GK414d454f4445564143434553}"
SECRET_KEY="${S3_SECRET_KEY:-000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f}"
ZONE="${GARAGE_ZONE:-dc1}"
CAPACITY="${GARAGE_CAPACITY:-1G}"

garage() {
  docker compose exec -T garage /garage "$@"
}

need_garage() {
  if ! garage status >/dev/null 2>&1; then
    echo "Garage service is not available. Start it with: docker compose up -d garage" >&2
    exit 1
  fi
}

assign_single_node_layout() {
  status="$(garage status 2>/dev/null || true)"
  node_id="$(printf '%s\n' "$status" | awk '/NO ROLE ASSIGNED/ {print $1; exit}')"

  if [ -z "$node_id" ]; then
    echo "Garage layout already has an assigned role."
    return
  fi

  current_version="$(garage layout show 2>/dev/null | awk '/Current cluster layout version:/ {print $5; exit}')"
  next_version=$((current_version + 1))

  echo "Assigning Garage node $node_id to zone $ZONE."
  garage layout assign -z "$ZONE" -c "$CAPACITY" "$node_id" >/dev/null
  garage layout apply --version "$next_version" >/dev/null
}

ensure_bucket() {
  if garage bucket info "$BUCKET" >/dev/null 2>&1; then
    echo "Garage bucket '$BUCKET' already exists."
    return
  fi

  echo "Creating Garage bucket '$BUCKET'."
  garage bucket create "$BUCKET" >/dev/null
}

ensure_key() {
  if garage key info "$KEY_NAME" >/dev/null 2>&1; then
    echo "Garage key '$KEY_NAME' already exists."
    return
  fi

  echo "Importing deterministic development Garage key '$KEY_NAME'."
  garage key import --yes -n "$KEY_NAME" "$ACCESS_KEY" "$SECRET_KEY" >/dev/null
}

grant_bucket_access() {
  echo "Granting '$KEY_NAME' read/write/owner access to '$BUCKET'."
  garage bucket allow --read --write --owner "$BUCKET" --key "$KEY_NAME" >/dev/null
}

need_garage
assign_single_node_layout
ensure_bucket
ensure_key
grant_bucket_access

cat <<EOF
Garage development storage is ready.

S3_BUCKET=$BUCKET
S3_ACCESS_KEY=$ACCESS_KEY
S3_SECRET_KEY=$SECRET_KEY
EOF
