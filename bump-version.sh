#!/bin/bash

set -ex

npm --no-git-tag-version version patch

git add .

git commit -m "Bump version"

git tag $PACKAGE_VERSION

git push