# 🔒 Security Guidelines for WarrantyDog

## ⚠️ **CRITICAL: Never Commit Sensitive Data**

This is a **PUBLIC REPOSITORY**. Never commit any of the following:

### 🚫 **NEVER COMMIT:**

#### **Real Device Data**
- ❌ Actual device serial numbers or service tags
- ❌ Real employee names, usernames, or computer names  
- ❌ Actual location data, building names, or site information
- ❌ Real system information reports from production environments

#### **API Credentials**
- ❌ Dell API keys or secrets
- ❌ Lenovo client IDs or secrets
- ❌ Any vendor API credentials or tokens
- ❌ OAuth tokens or refresh tokens

#### **Database Files**
- ❌ SQLite database files (`.db`, `.sqlite`, `.sqlite3`)
- ❌ Database WAL files (`.db-wal`, `.db-shm`)
- ❌ Any files containing real warranty lookup data

#### **Configuration Files**
- ❌ Environment files with real credentials (`.env`)
- ❌ Configuration files with production settings
- ❌ Any files containing real API endpoints or secrets

## ✅ **SAFE TO COMMIT:**

### **Demo/Test Data Only**
- ✅ Dummy device serial numbers (e.g., `ABC1234`, `XYZ5678`)
- ✅ Fake employee names (e.g., `DEMO-DEVICE-01`)
- ✅ Generic location data (e.g., `Demo Office - Building A`)
- ✅ Sanitized system reports with no real information

### **Example Files**
- ✅ `test_devices_sample.csv` - Contains only dummy data
- ✅ `examples/sample-system-report.csv` - Sanitized demo data
- ✅ Documentation and code examples

## 🛡️ **Security Best Practices**

### **Local Development**
1. **Store credentials locally only:**
   - Use browser localStorage for API keys during development
   - Use environment variables for server-side credentials
   - Never commit `.env` files or configuration with real data

2. **Use dummy data for testing:**
   - Create test files with fake serial numbers
   - Use generic location and employee names
   - Test with demo data that doesn't expose real information

3. **Database security:**
   - SQLite databases are automatically ignored by `.gitignore`
   - Never commit database files with real warranty data
   - Use clean databases for testing and documentation

### **Git Hygiene**
1. **Check before committing:**
   ```bash
   git status
   git diff --cached
   ```

2. **Use .gitignore patterns:**
   - All database files are ignored
   - Real test data patterns are blocked
   - Sensitive file extensions are protected

3. **Verify clean commits:**
   ```bash
   git log --name-only -1
   ```

## 🚨 **If Sensitive Data is Accidentally Committed**

### **Immediate Actions:**
1. **Stop and don't push** if you haven't pushed yet
2. **Remove the sensitive files** from the working directory
3. **Clean git history** using `git filter-branch` or BFG Repo-Cleaner
4. **Force push** to overwrite the remote repository
5. **Rotate any exposed credentials** immediately

### **History Cleanup Commands:**
```bash
# Remove sensitive files from all history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch sensitive-file.csv" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up backup refs
git for-each-ref --format="%(refname)" refs/original/ | \
  ForEach-Object { git update-ref -d $_ }

# Expire reflog and garbage collect
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to overwrite remote
git push --force-with-lease origin main
```

## 📋 **Security Checklist**

Before committing, verify:

- [ ] No real device serial numbers or service tags
- [ ] No actual employee names or usernames
- [ ] No real location or building information
- [ ] No API credentials or tokens
- [ ] No database files with real data
- [ ] No environment files with production settings
- [ ] Only dummy/demo data in test files
- [ ] All sensitive patterns covered by `.gitignore`

## 🔍 **Audit Commands**

### **Check for sensitive data:**
```bash
# Search for potential serial numbers (alphanumeric patterns)
git log --all -S"[A-Z0-9]{7,}" --source --all

# Check for database files in history
git log --all --full-history -- "*.db" "*.sqlite*"

# Search for potential API keys
git log --all -S"api" -S"key" -S"secret" --source --all
```

### **Verify .gitignore is working:**
```bash
# Test if sensitive files would be ignored
git check-ignore test_real_devices.csv
git check-ignore data/warrantydog.db
```

## 📞 **Security Contact**

If you discover sensitive data in the repository:
1. **Do not clone or download** the repository
2. **Report immediately** to the repository maintainer
3. **Do not share or distribute** any sensitive information found

---

**Remember: This is a PUBLIC repository. When in doubt, don't commit it!**
