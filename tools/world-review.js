(async () => { await new Promise(r=>setTimeout(r,18000)); window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ'})); await new Promise(r=>setTimeout(r,5000)); })()
