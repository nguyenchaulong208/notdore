#!/usr/bin/env python3
"""Fix the filterCommunes function by removing orphaned code."""

with open('assets/js/dia-gioi.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Lines 487-495 are orphaned (0-indexed: 486-494)
# Lines 497-521 are orphaned return statements (0-indexed: 496-520)

# We need to:
# 1. Remove lines 487-495 (0-indexed: 486-494)
# 2. Remove lines 497-521 (0-indexed: 496-520)
# 3. The 'return all.filter(...)' should be moved to before the orphaned code

# Read the file
with open('assets/js/dia-gioi.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the orphaned code
orphaned_start = content.find('    const matchedProvinceCodes = new Set(query ? [', 4800)
orphaned_end = content.find('];);', orphaned_start) + 3

# Find the orphaned return statement
return_start = content.find('    return all.filter((c) => {', orphaned_end)
return_end = content.find('});', return_start) + 2  # include '});'

print(f'Orphaned code: {orphaned_start} to {orphaned_end}')
print(f'Orphaned return: {return_start} to {return_end}')

# The cleanest approach: 
# 1. Remove the duplicated matchedProvinceCodes (lines 487-495)
# 2. Keep the return statement in place (it's already in the function)

# Actually, looking at the code again, the problem is:
# Line 486: }; closes the function
# Line 487-495: orphaned code
# Line 497-521: orphaned return statement

# The fix is to:
# 1. Remove lines 487-495 (orphaned matchedProvinceCodes)
# 2. The return statement on line 497 is actually the correct position (it's before the orphaned code)

# But wait, the function ends at line 486. So the return statement on line 497 is also orphaned.
# We need to move it to before line 487.

# Let me try a different approach: find the end of the function and replace it
# The function should end at the first '};' after the return statement

# Find the end of the function (the first '};' after 'return all.filter')
func_end = content.find('});', 486) + 2

# Find the orphaned code
orphaned_content = content[orphaned_start:orphaned_end]

# Find the return statement
return_content = content[return_start:return_end]

# The cleanest fix: 
# 1. Remove the orphaned code (matchedProvinceCodes definition)
# 2. Keep the return statement in place

# Actually, let me just remove the orphaned code
# The return statement is already in the correct position (line 497)
# But the function ends at line 486, so the return statement is orphaned too

# Let me find the correct function end
# The function should end at the first '};' after the matchedProvinceCodes definition
# But the matchedProvinceCodes is duplicated

# The cleanest fix:
# 1. Remove the orphaned matchedProvinceCodes (487-495)
# 2. The return statement (497-521) should be moved up, but since it's the last statement before '};',
#    we can just move the '};' up

# Actually, the simplest approach:
# 1. Remove orphaned content (487-495 and 497-521)
# 2. Keep the '};' on line 486
# 3. The return statement should be before the orphaned code

# Let me try a different approach - find the exact function boundaries

# The function starts at 'const filterCommunes = () => {'
# It ends at the first '};' after the return statement

# Find the return statement
return_stmt = '    return all.filter((c) => {'
return_pos = content.find(return_stmt)

# Find the '};' after the return statement
func_end_pos = content.find('});', return_pos) + 2

# Find the orphaned code
orphaned_start_pos = content.find('    const matchedProvinceCodes = new Set(query ? [', func_end_pos)
orphaned_end_pos = content.find('];);', orphaned_start_pos) + 3

print(f'Function end: {func_end_pos}')
print(f'Orphaned start: {orphaned_start_pos}, end: {orphaned_end_pos}')

# The structure should be:
# 1. ... matchedProvinceCodes definition (line 451)
# 2. return all.filter(...) (line 461)
# 3. }; (line 486)

# But the current structure is:
# 1. ... matchedProvinceCodes definition (line 451)
# 2. return all.filter(...) (line 461)
# 3. }; (line 486)
# 4. orphaned matchedProvinceCodes (487-495)
# 5. orphaned return all.filter(...) (497-521)

# The fix:
# 1. Remove lines 487-495 (orphaned matchedProvinceCodes)
# 2. Keep line 497-521 as is (it's the return statement)

# Wait, I need to understand the structure better. Let me count the braces.

# Actually, let me just remove the orphaned content and the duplicate matchedProvinceCodes
# The function should end at the '};' on line 486

# Remove orphaned code (487-495 and 497-521)
# Keep everything else

# Find the orphaned section
orphaned_section = content[orphaned_start_pos:orphaned_end_pos]
return_section = content[return_pos:return_end_pos]

print(f'Orphaned section: {orphaned_section[:100]}...')
print(f'Return section: {return_section[:100]}...')

# The fix is to remove the orphaned content and keep the return statement
# But we need to be careful about the function boundaries

# Let me try a different approach:
# 1. Remove the orphaned code
# 2. Keep the return statement

# The orphaned code is:
#     const matchedProvinceCodes = new Set(query ? [
#       ...
#     ] : []);

# And the return statement is:
#     return all.filter((c) => { ... });

# I'll remove the orphaned code and keep the return statement
# But I need to find where the function ends

# The function currently ends at line 486. The orphaned code follows it.
# I'll remove the orphaned code and the duplicate return statement.

# Actually, looking at the structure again:
# Line 486: }; - closes filterCommunes
# Line 487-495: orphaned matchedProvinceCodes definition
# Line 497-521: orphaned return all.filter(...) 

# The correct structure should be:
# Line 486: }; - closes filterCommunes
# (no orphaned code)

# So I need to remove lines 487-495 and 497-521.

# Let me use a simple string replacement
orphaned_content = content[orphaned_start_pos:orphaned_end_pos]

# But the return statement is also orphaned. I need to remove it too.
# But I need to find the correct function end

# The correct function end is the first '};' after the return statement
# But the return statement is orphaned

# Let me try yet another approach:
# 1. Find the function start
# 2. Find the function end (the first '};' after the return statement)
# 3. Remove the orphaned code

# The function should be:
# const filterCommunes = () => {
#   ...
#   return all.filter((c) => {
#     ...
#   }).sort((a, b) => ...);
# };

# Let me find the end of the function
# The function ends at the first '};' after 'return all.filter'

# Find the return statement
return_stmt = '      return all.filter((c) => {'
return_pos = content.find(return_stmt)

# Find the end of the function
# It's the '});' after the return statement
func_end = content.find('});', return_pos) + 2

# Find the orphaned code
orphaned_start = content.find('    const matchedProvinceCodes = new Set(query ? [', func_end)
orphaned_end = content.find('];);', orphaned_start) + 3

print(f'func_end: {func_end}')
print(f'orphaned_start: {orphaned_start}, orphaned_end: {orphaned_end}')

# Remove the orphaned content
new_content = content[:orphaned_start] + content[orphaned_end:]

with open('assets/js/dia-gioi.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Fixed successfully')
