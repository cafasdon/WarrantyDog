# Contributing to WarrantyDog

Thank you for considering contributing to WarrantyDog! This document provides guidelines and information for contributors.

## 🚀 Getting Started

1. Fork the repository
2. Clone your fork locally
3. Run the setup script: `./scripts/setup.sh`
4. Create a new branch for your feature: `git checkout -b feature/your-feature-name`

## 📋 Development Guidelines

### Code Style
- Use ES6+ JavaScript features
- Follow consistent indentation (2 spaces)
- Use meaningful variable and function names
- Add comments for complex logic

### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
feat: add HP warranty API integration
fix: resolve CSV parsing issue with special characters
docs: update API documentation
test: add unit tests for Dell API
```

### Adding New Vendors

1. **Research the API**
   - Check CORS support
   - Understand authentication requirements
   - Review rate limits

2. **Update vendorApis.js**
   ```javascript
   case 'newvendor':
       return await newVendorLookup(serial);
   ```

3. **Implement the lookup function**
   ```javascript
   async function newVendorLookup(serial) {
       // Implementation here
   }
   ```

4. **Update documentation**
   - Add vendor to README.md table
   - Document any special requirements

5. **Add tests**
   - Unit tests for the API function
   - Integration tests with sample data

### Testing

Before submitting a PR:

```bash
# Run tests
npm test

# Test with sample data
# Upload examples/sample-devices.csv to the app

# Check for console errors
# Verify CSV export works correctly
```

## 🐛 Bug Reports

When filing a bug report, please include:

1. **Environment**: Browser version, OS
2. **Steps to reproduce**: Clear, numbered steps
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Sample data**: CSV file that causes the issue (remove sensitive data)

## 💡 Feature Requests

For feature requests, please:

1. Check existing issues first
2. Describe the use case
3. Explain why it would be valuable
4. Consider implementation complexity

## 📝 Documentation

Help improve our documentation:

- Fix typos and unclear explanations
- Add examples and use cases
- Update API documentation
- Improve setup instructions

## 🔒 Security

- Never commit API keys or sensitive data
- Use localStorage for browser-only API keys
- Report security issues privately via email

## 📞 Questions?

- Open an issue for general questions
- Check existing documentation first
- Be specific about your use case

Thank you for contributing! 🐕
