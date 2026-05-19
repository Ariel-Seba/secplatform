#!/bin/bash
set -e

MODULE_NAME=$1
MODULE_PORT=${2:-8099}
TEMPLATE_DIR="$(dirname "$0")/../modules/_template"
MODULE_DIR="$(dirname "$0")/../modules/$MODULE_NAME"

if [ -z "$MODULE_NAME" ]; then
  echo "Usage: ./scripts/new-module.sh <module-name> <port>"
  echo "Example: ./scripts/new-module.sh forensics 8004"
  exit 1
fi

if [ -d "$MODULE_DIR" ]; then
  echo "Error: Module '$MODULE_NAME' already exists at $MODULE_DIR"
  exit 1
fi

echo "Creating module: $MODULE_NAME on port $MODULE_PORT"
cp -r "$TEMPLATE_DIR" "$MODULE_DIR"

# Update module.json
sed -i.bak "s/\"_template\"/\"$MODULE_NAME\"/" "$MODULE_DIR/module.json"
sed -i.bak "s/Module Template/$MODULE_NAME/" "$MODULE_DIR/module.json"
sed -i.bak "s/8099/$MODULE_PORT/" "$MODULE_DIR/module.json"
rm -f "$MODULE_DIR/module.json.bak"

# Update Dockerfile port
sed -i.bak "s/8099/$MODULE_PORT/" "$MODULE_DIR/Dockerfile"
rm -f "$MODULE_DIR/Dockerfile.bak"

# Update main.py port
sed -i.bak "s/\"8099\"/\"$MODULE_PORT\"/" "$MODULE_DIR/main.py"
rm -f "$MODULE_DIR/main.py.bak"

mkdir -p "$MODULE_DIR/tools"
touch "$MODULE_DIR/tools/__init__.py"
touch "$MODULE_DIR/__init__.py"

echo ""
echo "✅ Module '$MODULE_NAME' created at $MODULE_DIR"
echo ""
echo "Next steps:"
echo "  1. Edit modules/$MODULE_NAME/module.json"
echo "  2. Implement modules/$MODULE_NAME/tools/__init__.py"
echo "  3. Edit modules/$MODULE_NAME/Dockerfile (add system packages)"
echo "  4. Add to infra/docker-compose.yml"
echo "  5. Run: checkov -d modules/$MODULE_NAME --framework dockerfile"
