#!/usr/bin/env python3
# Update dia-gioi.js to handle 'huyện X, tỉnh Y' queries

with open('assets/js/dia-gioi.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the filterCommunes function and add logic to handle 'huyện X, tỉnh Y' queries
# We'll insert the new helper function before filterCommunes and modify filterCommunes
old_code = """  const filterCommunes = () => {
    const all = state.communes?.communes || [];
    const query = state.q;
    const normalizedQuery = normalize(query);
    const queryWords = ` ${normalizedQuery.replace(/[^a-z0-9]+/g, ' ')} `;
    const containsDistrict = / (quan|huyen|thi xa|thi tran) /.test(queryWords);
    const oldProvinceCodes = new Set(query
      ? state.data.history
        .filter((h) => addressContains(query, h.oldName))
        .map((h) => h.newCode)
      : []);
    const matchedCommuneCodes = new Set(query
      ? all.filter((c) => {
        const names = [
          c.name,
          c.shortCodename?.replace(/_/g, ' '),
          ...(c.beforeNames || []),
        ].filter(Boolean);
        const exactCurrentName = names.some((name) => {
          const fullName = normalize(name);
          return fullName.length > 3 && normalizedQuery.includes(fullName);
        });
        if (exactCurrentName) {
          return !containsDistrict || state.direction === 'current-to-before';
        }

        const shortNameMatch = names.some((name) => addressContains(query, name));
        return shortNameMatch &&
          (state.direction === 'current-to-before' || oldProvinceCodes.size === 0);
      }).map((c) => c.code)
      : []);"""

new_code = """  const parseDistrictProvinceQuery = (query) => {
    // Parse 'huyện X, tỉnh Y' or 'huyện X tỉnh Y' into { districtName, provinceName }
    const normalizedQuery = normalize(query);
    const queryWords = ` ${normalizedQuery.replace(/[^a-z0-9]+/g, ' ')} `;
    // Match 'huyen <name>' at the end (possibly followed by ', tỉnh Y')
    const districtMatch = queryWords.match(/(huyen|thi xa|thi tran)\\\\s+([a-z0-9\\\\s]+?)(?:,\\\\s*tinh|tỉnh)?$/i);
    if (!districtMatch) return null;
    const districtName = districtMatch[2].trim();
    // Get province name from query if present
    const provinceMatch = queryWords.match(/tinh\\\\s+([a-z0-9\\\\s]+)/i);
    const provinceName = provinceMatch ? provinceMatch[1].trim() : null;
    return { districtName, provinceName };
  };

  const filterCommunes = () => {
    const all = state.communes?.communes || [];
    const query = state.q;
    const normalizedQuery = normalize(query);
    const queryWords = ` ${normalizedQuery.replace(/[^a-z0-9]+/g, ' ')} `;
    const containsDistrict = / (quan|huyen|thi xa|thi tran) /.test(queryWords);
    const oldProvinceCodes = new Set(query
      ? state.data.history
        .filter((h) => addressContains(query, h.oldName))
        .map((h) => h.newCode)
      : []);

    // Handle 'huyện X, tỉnh Y' pattern: search for communes in province Y with name X
    const districtProvince = parseDistrictProvinceQuery(query);
    let matchedCommuneCodes = new Set();
    let matchedProvinceCodes = new Set();

    if (districtProvince) {
      const { districtName, provinceName } = districtProvince;
      // Find matching province (by name)
      const province = state.data.provinces.find(p =>
        p.name && normalize(p.name).startsWith(normalize(provinceName))
      );
      const targetProvinceCode = province?.code || null;
      const targetProvinceGeoCode = province?.geoCode || null;

      if (targetProvinceCode || targetProvinceGeoCode) {
        matchedProvinceCodes.add(targetProvinceCode || null);
        // Filter communes in the target province whose name contains districtName
        const filtered = all.filter(c => {
          const names = [
            c.name,
            c.shortCodename?.replace(/_/g, ' '),
            ...(c.beforeNames || []),
          ].filter(Boolean);
          const nameMatch = names.some(name => {
            const fullName = normalize(name);
            return fullName.length > 3 && normalizedQuery.includes(fullName);
          });
          return nameMatch && (c.provinceCode === targetProvinceCode || c.geoProvinceCode === targetProvinceGeoCode);
        });
        matchedCommuneCodes = new Set(filtered.map(c => c.code));
      }
    }

    const fallbackMatchedCommuneCodes = new Set(query
      ? all.filter((c) => {
        const names = [
          c.name,
          c.shortCodename?.replace(/_/g, ' '),
          ...(c.beforeNames || []),
        ].filter(Boolean);
        const exactCurrentName = names.some((name) => {
          const fullName = normalize(name);
          return fullName.length > 3 && normalizedQuery.includes(fullName);
        });
        if (exactCurrentName) {
          return !containsDistrict || state.direction === 'current-to-before';
        }

        const shortNameMatch = names.some((name) => addressContains(query, name));
        return shortNameMatch &&
          (state.direction === 'current-to-before' || oldProvinceCodes.size === 0);
      }).map((c) => c.code)
      : []);

    if (districtProvince && (matchedCommuneCodes.size > 0 || matchedProvinceCodes.has(null))) {
      return all.filter(c => matchedCommuneCodes.has(c.code));
    }

    const matchedCommuneCodes = matchedCommuneCodes || fallbackMatchedCommuneCodes;
    const matchedProvinceCodes = matchedProvinceCodes || new Set(query ? [
      ...state.data.provinces
        .filter((p) => [p.name, p.renamedFrom, ...(p.mergedFrom || [])]
          .some((name) => addressContains(query, name)))
        .map((p) => p.code),
      ...state.data.history
        .filter((h) => addressContains(query, h.oldName))
        .map((h) => h.newCode),
    ] : []);

    return all.filter((c) => {
      if (state.communeProvince !== 'all' && c.provinceCode !== state.communeProvince) return false;
      if (state.communeType !== 'all' && c.type !== state.communeType) return false;
      if (!query) return true;
      if (matchedCommuneCodes.size) {
        return matchedCommuneCodes.has(c.code) &&
          (!matchedProvinceCodes.size || matchedProvinceCodes.has(c.provinceCode));
      }
      if (matchedProvinceCodes.size) return matchedProvinceCodes.has(c.provinceCode);
      return matches(
        [
          c.name,
          c.typeLabel,
          c.provinceName,
          c.code,
          c.shortCodename,
          ...(c.beforeNames || []),
          c.beforeProvinceName,
        ].join(' '),
        query,
      );
    }).sort((a, b) =>
      scoreName(b.name, query) - scoreName(a.name, query) ||
      a.name.localeCompare(b.name, 'vi')
    );
  };"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with open('assets/js/dia-gioi.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated dia-gioi.js successfully')
else:
    print('OLD CODE NOT FOUND')
    print('Looking for filterCommunes function...')
    import re
    match = re.search(r'const filterCommunes = \(\) => \{.*?\n  };\s*\n\s*\n\s*\n\s*\n\s*const renderCommunes', content, re.DOTALL)
    if match:
        print('Found filterCommunes function:')
        print(match.group(0)[:1500])
