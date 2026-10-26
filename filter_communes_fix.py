  const parseDistrictProvinceQuery = (query) => {
    // Parse 'huyện X, tỉnh Y' or 'huyện X tỉnh Y' into { districtName, provinceName }
    const normalizedQuery = normalize(query);
    const queryWords = ` ${normalizedQuery.replace(/[^a-z0-9]+/g, ' ')} `;
    const districtMatch = queryWords.match(/(huyen|thi xa|thi tran)\s+([a-z0-9\s]+?)(?:\s*tinh|tỉnh)?$/i);
    if (!districtMatch) return null;
    const districtName = districtMatch[2].trim();
    const provinceMatch = queryWords.match(/tinh\s+([a-z0-9\s]+)/i);
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

    // Parse 'huyện X, tỉnh Y' pattern
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

    if (districtProvince && (matchedCommuneCodes.size > 0 || matchedProvinceCodes.has(null))) {
      return all.filter(c => matchedCommuneCodes.has(c.code));
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
  };
