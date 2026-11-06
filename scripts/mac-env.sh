# shellcheck shell=bash
# Gemeinsame Werkzeug-Einrichtung für mac-setup.sh und mac-run-simulator.sh.
# Node 22 und CocoaPods werden ohne Homebrew im Benutzerverzeichnis abgelegt,
# weil Homebrew Intel-Macs nicht mehr vollständig unterstützt.

TOOLS_DIR=${EC_TOOLS_DIR:-$HOME/.local}
NODE_MAJOR=22
# Portables Ruby aus dem Homebrew-Projekt (läuft eigenständig, ohne Homebrew).
RUBY_VERSION=3.4.5
RUBY_SHA256=0c78b38f22fb9b42df6918db00e6f5a80d5b35164f910ffe4c89159326ae98cf

export PATH="$TOOLS_DIR/node/bin:$TOOLS_DIR/ruby/bin:$PATH"

node_major() {
  command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' || true
}

ensure_node() {
  [[ $(node_major) == "$NODE_MAJOR" ]] && return
  local base="https://nodejs.org/dist/latest-v$NODE_MAJOR.x"
  local line file tmp
  line=$(curl -fsSL "$base/SHASUMS256.txt" | grep -E "node-v$NODE_MAJOR\.[0-9.]+-darwin-x64\.tar\.gz$")
  file=${line##* }
  tmp=$(mktemp -d)
  echo "Installiere ${file%.tar.gz} nach $TOOLS_DIR …"
  curl -fsSL "$base/$file" -o "$tmp/$file"
  (cd "$tmp" && echo "$line" | shasum -a 256 -c -)
  mkdir -p "$TOOLS_DIR"
  tar -xzf "$tmp/$file" -C "$TOOLS_DIR"
  ln -sfn "$TOOLS_DIR/${file%.tar.gz}" "$TOOLS_DIR/node"
  rm -rf "$tmp"
  if [[ $(node_major) != "$NODE_MAJOR" ]]; then
    echo "Node $NODE_MAJOR konnte nicht aktiviert werden." >&2
    exit 1
  fi
}

ensure_cocoapods() {
  command -v pod >/dev/null 2>&1 && return
  if [[ ! -x $TOOLS_DIR/ruby/bin/ruby ]]; then
    local file="portable-ruby-$RUBY_VERSION.el_capitan.bottle.tar.gz" tmp
    tmp=$(mktemp -d)
    echo "Installiere portables Ruby $RUBY_VERSION nach $TOOLS_DIR …"
    curl -fsSL "https://github.com/Homebrew/homebrew-portable-ruby/releases/download/$RUBY_VERSION/$file" -o "$tmp/$file"
    (cd "$tmp" && echo "$RUBY_SHA256  $file" | shasum -a 256 -c -)
    mkdir -p "$TOOLS_DIR"
    tar -xzf "$tmp/$file" -C "$TOOLS_DIR"
    ln -sfn "$TOOLS_DIR/portable-ruby/$RUBY_VERSION" "$TOOLS_DIR/ruby"
    rm -rf "$tmp"
  fi
  "$TOOLS_DIR/ruby/bin/gem" install cocoapods --no-document
}
