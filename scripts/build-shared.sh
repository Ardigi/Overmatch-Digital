#!/bin/bash

# Build shared modules

echo "Building shared modules..."

# Build events module
echo "Building @soc-compliance/events..."
cd /mnt/c/Users/Ryann/Documents/Work/Coding/overmatch-digital/shared/events
npx tsc

# Build contracts module  
echo "Building @soc-compliance/contracts..."
cd /mnt/c/Users/Ryann/Documents/Work/Coding/overmatch-digital/shared/contracts
npx tsc

echo "Shared modules built successfully!"