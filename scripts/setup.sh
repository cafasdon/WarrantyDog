#!/bin/bash

# WarrantyDog Setup Script
echo "🐕 Setting up WarrantyDog..."

# Create lib directory if it doesn't exist
mkdir -p lib

# Download PapaParse
echo "📦 Downloading PapaParse..."
curl -o lib/papaparse.min.js https://unpkg.com/papaparse@5.4.1/papaparse.min.js

if [ $? -eq 0 ]; then
    echo "✅ PapaParse downloaded successfully"
else
    echo "❌ Failed to download PapaParse"
    exit 1
fi

# Create examples directory and sample CSV
mkdir -p examples

cat > examples/sample-devices.csv << 'EOF'
vendor,serial,model,location
Dell,ABCD123,OptiPlex 7090,Office-Floor1
Dell,EFGH456,Latitude 5520,Remote-User1
Lenovo,IJKL789,ThinkPad X1,Office-Floor2
HP,MNOP012,EliteBook 840,Remote-User2
Dell,QRST345,PowerEdge R740,DataCenter-Rack1
EOF

echo "📄 Created sample CSV file: examples/sample-devices.csv"

# Create docs directory
mkdir -p docs

# Create tests directory
mkdir -p tests

echo "🎉 Setup complete! Open index.html in your browser to get started."
echo ""
echo "Next steps:"
echo "1. Configure your Dell API key in the browser console:"
echo "   localStorage.setItem('dell_api_key', 'your_api_key_here');"
echo "2. Test with the sample CSV file in examples/"
echo "3. Check the README.md for more information"

# MIT License

Copyright (c) 2024 WarrantyDog Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

