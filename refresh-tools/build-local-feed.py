# Build Merchant Center LOCAL inventory feed from the canonical product feed.
# Usage: python3 build-local-feed.py [STORE_CODE]
# Emits one row per product id: store_code, id, availability.
import sys
code = sys.argv[1] if len(sys.argv) > 1 else 'STORE_CODE_PENDING'
rows = []
with open('product-feed.txt', encoding='utf-8') as f:
    header = f.readline().rstrip('\n').split('\t')
    idx = header.index('id')
    for line in f:
        pid = line.rstrip('\n').split('\t')[idx]
        rows.append('%s\t%s\tin_stock' % (code, pid))
with open('local-inventory-feed.txt', 'w', encoding='utf-8') as f:
    f.write('store_code\tid\tavailability\n')
    f.write('\n'.join(rows) + '\n')
print('local feed rows:', len(rows), '| store_code:', code)
