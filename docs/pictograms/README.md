# Exercise pictograms

Contact sheets of every drawing in `src/ui/pictograms.ts` (`PICTOGRAMS`), each shown at 64 px on the badge
background and at 24 px, followed by the original drawings from `src/ui/exerciseIcons.ts` for comparison.

| Image | Shows |
| --- | --- |
| `pictograms-light.png` | All 51 pictogram keys, then the 9 original exercise and 4 kind drawings, light theme |
| `pictograms-dark.png` | The same, dark theme |

Re-render after changing a drawing (needs Google Chrome; set `CHROME` to point elsewhere):

```sh
node --experimental-strip-types scripts/render-pictograms.mjs
```

`squat`, `deadlift`, `bench`, `overhead-press`, `dip`, `row` and `curl` reuse the original exercise drawings.
