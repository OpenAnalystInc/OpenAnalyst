#!/bin/sh

echo "Oacode state is being reset.  This probably doesn't work while VS Code is running."

# Reset the secrets:
sqlite3 ~/Library/Application\ Support/Code/User/globalStorage/state.vscdb \
"DELETE FROM ItemTable WHERE \
    key = 'oacode.oa-code' OR \
    key LIKE 'workbench.view.extension.oa-code%' OR \
    key LIKE 'secret://{\"extensionId\":\"oacode.oa-code\",%';"

# delete all oacode state files:
rm -rf ~/Library/Application\ Support/Code/User/globalStorage/oacode.oa-code/

# clear some of the vscode cache that I've observed contains oacode related entries:
rm -f ~/Library/Application\ Support/Code/CachedProfilesData/__default__profile__/extensions.user.cache
