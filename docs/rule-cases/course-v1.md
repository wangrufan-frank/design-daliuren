# Verified course projection traceability

| Course field group | Authoritative upstream | Exact regression |
| --- | --- | --- |
| Time, lunar date, pillars, month build, month general, divination hour | `CalendarResult` | `course/policy.test.ts` context projection and `calendar` canonical tests |
| Location name | submitted `CourseInput.locationName` | `course/policy.test.ts` context projection |
| Method, subtype, variants, transmission branches, six relations | `ThreeTransmissionsResult` | `course/policy.test.ts` method/transmission projection and three-transmissions policy tests |
| Four lesson upper/lower values | `FourLessonsResult` | `course/policy.test.ts` lesson projection and four-lessons policy tests |
| Transmission and lesson generals | `HeavenlyGeneralsResult` lookup by heaven branch | `course/policy.test.ts` general mapping and heavenly-generals lookup tests |
| Twelve palace earth/heaven/general mapping | `HeavenlyGeneralsResult.placements` | `course/policy.test.ts` palace projection and heavenly-generals placement tests |
| Day/night noble, noble heaven branch, noble earth palace, direction | `HeavenlyGeneralsResult` | `course/policy.test.ts` noble projection and heavenly-generals policy tests |

`course/verified-projection-v1` adds no traditional rule. It excludes hidden stems, spirits, new lesson patterns, interpretations, 3D, image export, and printing.
