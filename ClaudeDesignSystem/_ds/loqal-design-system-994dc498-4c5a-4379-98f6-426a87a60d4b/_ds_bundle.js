/* @ds-bundle: {"format":4,"namespace":"LoqalDesignSystem_994dc4","components":[{"name":"MoneyRow","sourcePath":"components/data/MoneyRow.jsx"},{"name":"ResponsiveList","sourcePath":"components/data/ResponsiveList.jsx"},{"name":"StatusPill","sourcePath":"components/data/StatusPill.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"STATUS_MAP","sourcePath":"components/data/statusMap.js"},{"name":"ENUM_NAMES","sourcePath":"components/data/statusMap.js"},{"name":"ListState","sourcePath":"components/feedback/ListState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"DestructiveSheet","sourcePath":"components/overlays/DestructiveSheet.jsx"},{"name":"MobileActionBar","sourcePath":"components/overlays/MobileActionBar.jsx"},{"name":"Sheet","sourcePath":"components/overlays/Sheet.jsx"},{"name":"Alert","sourcePath":"components/primitives/Alert.jsx"},{"name":"Avatar","sourcePath":"components/primitives/Avatar.jsx"},{"name":"Badge","sourcePath":"components/primitives/Badge.jsx"},{"name":"Button","sourcePath":"components/primitives/Button.jsx"},{"name":"Card","sourcePath":"components/primitives/Card.jsx"},{"name":"CardHeader","sourcePath":"components/primitives/Card.jsx"},{"name":"CardTitle","sourcePath":"components/primitives/Card.jsx"},{"name":"CardDescription","sourcePath":"components/primitives/Card.jsx"},{"name":"CardContent","sourcePath":"components/primitives/Card.jsx"},{"name":"CardFooter","sourcePath":"components/primitives/Card.jsx"},{"name":"Checkbox","sourcePath":"components/primitives/Checkbox.jsx"},{"name":"Icon","sourcePath":"components/primitives/Icon.jsx"},{"name":"Input","sourcePath":"components/primitives/Input.jsx"},{"name":"Label","sourcePath":"components/primitives/Label.jsx"},{"name":"FieldHint","sourcePath":"components/primitives/Label.jsx"},{"name":"Progress","sourcePath":"components/primitives/Progress.jsx"},{"name":"Select","sourcePath":"components/primitives/Select.jsx"},{"name":"Separator","sourcePath":"components/primitives/Separator.jsx"},{"name":"Switch","sourcePath":"components/primitives/Switch.jsx"},{"name":"Tabs","sourcePath":"components/primitives/Tabs.jsx"},{"name":"Textarea","sourcePath":"components/primitives/Textarea.jsx"},{"name":"AppShell","sourcePath":"components/shell/AppShell.jsx"}],"sourceHashes":{"components/data/MoneyRow.jsx":"a5c78799c05e","components/data/ResponsiveList.jsx":"f3b8cf43b55c","components/data/StatusPill.jsx":"6aa1646c1873","components/data/Table.jsx":"2e44cbf79e98","components/data/statusMap.js":"0ef355998d7f","components/feedback/ListState.jsx":"6080918eb89a","components/feedback/Skeleton.jsx":"685587a606f7","components/overlays/DestructiveSheet.jsx":"51400f046930","components/overlays/MobileActionBar.jsx":"48eb449581ee","components/overlays/Sheet.jsx":"8856cde65fdb","components/primitives/Alert.jsx":"991817f8f103","components/primitives/Avatar.jsx":"9d2be34ec6eb","components/primitives/Badge.jsx":"2fd2171caf73","components/primitives/Button.jsx":"babd0c8bd65a","components/primitives/Card.jsx":"bc0869d2f169","components/primitives/Checkbox.jsx":"d9f7ff7d5ac5","components/primitives/Icon.jsx":"62765d9d3177","components/primitives/Input.jsx":"d41e30ed9d8c","components/primitives/Label.jsx":"180c784cb3f7","components/primitives/Progress.jsx":"12e294c5150d","components/primitives/Select.jsx":"5ae92d532b4c","components/primitives/Separator.jsx":"94f5a9e6be3e","components/primitives/Switch.jsx":"dc1b14e4eeae","components/primitives/Tabs.jsx":"31cd179e4199","components/primitives/Textarea.jsx":"52c03e268e6a","components/primitives/usePresence.js":"bd66988cd089","components/shell/AppShell.jsx":"377ec3ce06a6","ui_kits/admin-console/AdminApp.jsx":"21a329312809","ui_kits/admin-console/ApplicationsScreen.jsx":"7f1c92d704c3","ui_kits/admin-console/BrandDetailScreen.jsx":"59ce03a4a732","ui_kits/admin-console/SettlementScreen.jsx":"8b52b90254c6","ui_kits/admin-console/TryOnScreen.jsx":"06480f368e79","ui_kits/admin-console/data.js":"20cc6d6d4056","ui_kits/brand-console/BrandApp.jsx":"7679f88f4cc8","ui_kits/brand-console/BulkDrop.jsx":"4c35e8c426af","ui_kits/brand-console/CatalogScreen.jsx":"fdf0981388f0","ui_kits/brand-console/ChatScreen.jsx":"422dc14f0914","ui_kits/brand-console/MoneyScreen.jsx":"6ee44deaff5b","ui_kits/brand-console/OrderDetail.jsx":"1e7faae798cd","ui_kits/brand-console/OrdersScreen.jsx":"6b7d8fb518cf","ui_kits/brand-console/TodayScreen.jsx":"242a1c058dcf","ui_kits/brand-console/data.js":"eb618af716ab","ui_kits/sales-console/RegisterShop.jsx":"262b224c74a9","ui_kits/sales-console/SalesApp.jsx":"5e9f2569e31f","ui_kits/sales-console/SalesPack.jsx":"ccfde0cebbd8","ui_kits/sales-console/SetTerms.jsx":"80d56f414483","ui_kits/sales-console/data.js":"4adc0aa301b2"},"inlinedExternals":[],"unexposedExports":[{"name":"usePresence","sourcePath":"components/primitives/usePresence.js"}]} */

(() => {

const __ds_ns = (window.LoqalDesignSystem_994dc4 = window.LoqalDesignSystem_994dc4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/MoneyRow.jsx
try { (() => {
function fmt(abs, locale) {
  return abs.toLocaleString(locale === "ar" ? "ar-EG-u-nu-latn" : "en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function MoneyRow({
  amount = 0,
  variant = "hero",
  locale = "en",
  creditLabel,
  debitLabel,
  zeroLabel,
  note,
  className = ""
}) {
  const dir = amount > 0 ? "credit" : amount < 0 ? "debit" : "zero";
  const sign = dir === "credit" ? "+" : dir === "debit" ? "\u2212" : "";
  const defaults = {
    credit: locale === "ar" ? "لوكال مستحق عليها لك" : "Loqal owes you",
    debit: locale === "ar" ? "أنت مستحق عليك لـلوكال" : "You owe Loqal",
    zero: locale === "ar" ? "لا مستحقات" : "Nothing owed either way"
  };
  const party = dir === "credit" ? creditLabel || defaults.credit : dir === "debit" ? debitLabel || defaults.debit : zeroLabel || defaults.zero;
  const cls = ["lq-money", variant !== "hero" ? "lq-money--" + variant : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    "data-dir": dir,
    "aria-label": party + ": " + fmt(Math.abs(amount), "en") + " EGP"
  }, variant === "inline" ? null : /*#__PURE__*/React.createElement("div", {
    className: "lq-money-party"
  }, party), /*#__PURE__*/React.createElement("div", {
    className: "lq-money-fig"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-money-sign",
    "aria-hidden": "true"
  }, sign || "0"), /*#__PURE__*/React.createElement("span", {
    className: "lq-money-amount"
  }, fmt(Math.abs(amount), locale)), /*#__PURE__*/React.createElement("span", {
    className: "lq-money-cur"
  }, "EGP")), note && variant !== "inline" ? /*#__PURE__*/React.createElement("div", {
    className: "lq-money-note"
  }, note) : null);
}
Object.assign(__ds_scope, { MoneyRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MoneyRow.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = [],
  onRowClick,
  locale = "en",
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-table-wrap " + className).trim()
  }, /*#__PURE__*/React.createElement("table", {
    className: "lq-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    "data-align": c.align,
    "data-num": c.num ? "" : undefined
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: row.id || i,
    onClick: onRowClick ? () => onRowClick(row) : undefined,
    style: onRowClick ? {
      cursor: "pointer"
    } : undefined
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    "data-align": c.align,
    "data-num": c.num ? "" : undefined
  }, c.render ? c.render(row, locale) : row[c.key])))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/data/statusMap.js
try { (() => {
/* One tone + AR/EN label per backend enum value. Tones map to the --state-*
   token triplets. Meanings: wait = the system is waiting on someone else,
   act = a human must do something now, live = in flight and correct,
   good = finished well, bad = finished badly, neutral = closed, no money moving. */
const STATUS_MAP = {
  BrandOrderStatus: {
    PENDING_VERIFICATION: {
      tone: "wait",
      en: "Awaiting verification",
      ar: "بانتظار التحقق"
    },
    PENDING_PAYMENT: {
      tone: "wait",
      en: "Awaiting payment",
      ar: "بانتظار الدفع"
    },
    PENDING_BRAND: {
      tone: "act",
      en: "Check the shelf",
      ar: "راجع الرف"
    },
    CONFIRMED: {
      tone: "live",
      en: "Confirmed",
      ar: "مؤكد"
    },
    PACKED: {
      tone: "live",
      en: "Packed",
      ar: "مُجهَّز"
    },
    HANDED_OVER: {
      tone: "live",
      en: "Handed over",
      ar: "تم التسليم للمندوب"
    },
    DELIVERED: {
      tone: "good",
      en: "Delivered",
      ar: "تم التوصيل"
    },
    DELIVERY_FAILED: {
      tone: "bad",
      en: "Delivery failed",
      ar: "فشل التوصيل"
    },
    RETURN_REQUESTED: {
      tone: "act",
      en: "Return requested",
      ar: "طلب إرجاع"
    },
    RETURNED: {
      tone: "neutral",
      en: "Returned",
      ar: "مُرجَع"
    },
    CANCELLED: {
      tone: "neutral",
      en: "Cancelled",
      ar: "ملغي"
    },
    REFUNDED: {
      tone: "neutral",
      en: "Refunded",
      ar: "تم الاسترداد"
    }
  },
  ReturnStatus: {
    REQUESTED: {
      tone: "act",
      en: "Requested",
      ar: "مطلوب"
    },
    APPROVED: {
      tone: "live",
      en: "Approved",
      ar: "مقبول"
    },
    REJECTED: {
      tone: "bad",
      en: "Rejected",
      ar: "مرفوض"
    },
    RESTOCKED: {
      tone: "good",
      en: "Restocked",
      ar: "أُعيد للمخزون"
    }
  },
  SettlementStatus: {
    PENDING: {
      tone: "wait",
      en: "Pending",
      ar: "معلق"
    },
    SENT: {
      tone: "live",
      en: "Sent",
      ar: "أُرسل"
    },
    RECEIVED: {
      tone: "good",
      en: "Received",
      ar: "تم الاستلام"
    },
    CANCELLED: {
      tone: "neutral",
      en: "Cancelled",
      ar: "ملغي"
    }
  },
  ProductStatus: {
    DRAFT: {
      tone: "neutral",
      en: "Draft",
      ar: "مسودة"
    },
    PUBLISHED: {
      tone: "good",
      en: "Published",
      ar: "منشور"
    },
    ARCHIVED: {
      tone: "neutral",
      en: "Archived",
      ar: "مؤرشف"
    }
  },
  BrandStatus: {
    PENDING: {
      tone: "wait",
      en: "Pending",
      ar: "معلق"
    },
    ACTIVE: {
      tone: "good",
      en: "Active",
      ar: "نشِط"
    },
    SUSPENDED: {
      tone: "bad",
      en: "Suspended",
      ar: "موقوف"
    }
  }
};
const ENUM_NAMES = Object.keys(STATUS_MAP);
Object.assign(__ds_scope, { STATUS_MAP, ENUM_NAMES });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/statusMap.js", error: String((e && e.message) || e) }); }

// components/data/StatusPill.jsx
try { (() => {
function StatusPill({
  enumName,
  value,
  locale = "en",
  size = "default",
  className = ""
}) {
  const entry = (__ds_scope.STATUS_MAP[enumName] || {})[value];
  const tone = entry ? entry.tone : "neutral";
  const label = entry ? entry[locale] || entry.en : String(value || "");
  return /*#__PURE__*/React.createElement("span", {
    className: ["lq-pill", "lq-pill--" + tone, size === "sm" ? "lq-pill--sm" : "", className].filter(Boolean).join(" "),
    title: enumName + "." + value,
    "data-status": value
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-pill-dot"
  }), label);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
function Skeleton({
  width,
  height,
  radius,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: ("lq-skel " + className).trim(),
    style: {
      display: "block",
      inlineSize: width,
      blockSize: height,
      borderRadius: radius,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/overlays/MobileActionBar.jsx
try { (() => {
/* Thumb reach. The primary action of a phone screen lives here, not in the top
   right of the header. Sticky to the bottom of the scroll container, blurred so
   the list underneath stays legible while it scrolls past. */
function MobileActionBar({
  hint,
  secondary,
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ["lq-actionbar", secondary ? "lq-actionbar--split" : "", className].filter(Boolean).join(" ")
  }, secondary, children, hint ? /*#__PURE__*/React.createElement("div", {
    className: "lq-actionbar-hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { MobileActionBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/MobileActionBar.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Avatar.jsx
try { (() => {
function Avatar({
  src,
  name = "",
  size = "default",
  square,
  className = ""
}) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return /*#__PURE__*/React.createElement("span", {
    className: ["lq-avatar", size !== "default" ? "lq-avatar--" + size : "", square ? "lq-avatar--square" : "", className].filter(Boolean).join(" "),
    title: name || undefined
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Badge({
  variant = "secondary",
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["lq-badge", "lq-badge--" + variant, className].filter(Boolean).join(" ")
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Badge.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* shadcn/ui Button plus a Loqal ripple. The ripple is not decoration here: the
   phone consoles are used one-handed in a noisy shop, and a press that leaves a
   visible mark is the only confirmation that a tap landed before the network
   answers. */
function Button({
  variant = "default",
  size = "default",
  ripple = true,
  className = "",
  children,
  onPointerDown,
  ...rest
}) {
  const [drops, setDrops] = React.useState([]);
  const handleDown = e => {
    if (ripple && variant !== "link" && !rest.disabled) {
      const r = e.currentTarget.getBoundingClientRect();
      const d = Math.max(r.width, r.height) * 2;
      const id = Date.now() + Math.random();
      setDrops(xs => [...xs, {
        id,
        style: {
          inlineSize: d,
          blockSize: d,
          left: e.clientX - r.left - d / 2,
          top: e.clientY - r.top - d / 2
        }
      }]);
      setTimeout(() => setDrops(xs => xs.filter(x => x.id !== id)), 540);
    }
    if (onPointerDown) onPointerDown(e);
  };
  const cls = ["lq-btn", "lq-btn--" + variant, size !== "default" ? "lq-btn--" + size : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    onPointerDown: handleDown
  }, rest), children, drops.map(d => /*#__PURE__*/React.createElement("span", {
    key: d.id,
    className: "lq-ripple",
    style: d.style
  })));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Button.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  flat,
  interactive,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["lq-card", flat ? "lq-card--flat" : "", interactive ? "lq-card--interactive" : "", className].filter(Boolean).join(" ")
  }, rest), children);
}
function CardHeader({
  className = "",
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-card-header " + className).trim()
  }, children);
}
function CardTitle({
  className = "",
  children
}) {
  return /*#__PURE__*/React.createElement("h3", {
    className: ("lq-card-title " + className).trim()
  }, children);
}
function CardDescription({
  className = "",
  children
}) {
  return /*#__PURE__*/React.createElement("p", {
    className: ("lq-card-desc " + className).trim()
  }, children);
}
function CardContent({
  className = "",
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-card-content " + className).trim()
  }, children);
}
function CardFooter({
  className = "",
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-card-footer " + className).trim()
  }, children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Card.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* shadcn/ui Checkbox: a button with role="checkbox" and a Lucide check
   indicator, not a native input. The whole row is the target and it is 44px tall. */
function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  className = "",
  ...rest
}) {
  const controlled = checked !== undefined;
  const [inner, setInner] = React.useState(!!defaultChecked);
  const on = controlled ? !!checked : inner;
  const toggle = () => {
    if (!controlled) setInner(!on);
    if (onCheckedChange) onCheckedChange(!on);
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "checkbox",
    "aria-checked": on,
    disabled: disabled,
    "data-on": on,
    "data-disabled": !!disabled,
    className: ("lq-check " + className).trim(),
    onClick: toggle
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "lq-check-box"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-check-ind"
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "lq-check-text"
  }, label) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide, the icon set shadcn/ui ships with, loaded as a CSS mask from
   lucide-static so the glyph inherits currentColor. Name = lucide kebab name. */
const LUCIDE = "https://unpkg.com/lucide-static@0.541.0/icons/";
function Icon({
  name,
  size = 16,
  strokeWidth,
  className = "",
  style,
  ...rest
}) {
  const url = LUCIDE + name + ".svg";
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true",
    "data-icon": name,
    className: ("lq-icon " + className).trim(),
    style: {
      inlineSize: size,
      blockSize: size,
      WebkitMaskImage: "url(" + url + ")",
      maskImage: "url(" + url + ")",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Icon.jsx", error: String((e && e.message) || e) }); }

// components/data/ResponsiveList.jsx
try { (() => {
/* System rule: one dataset, two renderings. Card stack below 768px, Table at
   768px and up. The switch is a container query, so a 390px phone frame inside a
   desktop page still gets cards. */
function ResponsiveList({
  columns = [],
  rows = [],
  renderCard,
  onRowClick,
  locale = "en",
  className = ""
}) {
  const [title, ...rest] = columns;
  const defaultCard = row => /*#__PURE__*/React.createElement(__ds_scope.Card, {
    interactive: !!onRowClick,
    onClick: onRowClick ? () => onRowClick(row) : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-row-top"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-title"
  }, title.render ? title.render(row, locale) : row[title.key]), rest[0] && rest[0].meta ? /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-meta"
  }, rest[0].render ? rest[0].render(row, locale) : row[rest[0].key]) : null), onRowClick ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    className: "lq-rl-chev",
    name: "chevron-right",
    size: 18
  }) : null), /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-fields"
  }, rest.filter(c => !c.meta).map(c => /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-field",
    key: c.key
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, c.label), /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-val",
    "data-num": c.num ? "" : undefined
  }, c.render ? c.render(row, locale) : row[c.key]))))));
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-rl " + className).trim()
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-cards"
  }, rows.map((row, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: row.id || i
  }, renderCard ? renderCard(row, locale) : defaultCard(row)))), /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-table"
  }, /*#__PURE__*/React.createElement(__ds_scope.Table, {
    columns: columns,
    rows: rows,
    onRowClick: onRowClick,
    locale: locale
  })));
}
Object.assign(__ds_scope, { ResponsiveList });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ResponsiveList.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ListState.jsx
try { (() => {
const GLYPH = {
  empty: "inbox",
  error: "triangle-alert",
  denied: "lock"
};
function ListState({
  state = "loading",
  rows = 3,
  title,
  body,
  actionLabel,
  onAction,
  requiredRole,
  className = ""
}) {
  if (state === "loading") {
    return /*#__PURE__*/React.createElement("div", {
      className: ("lq-rl-cards " + className).trim(),
      "aria-busy": "true"
    }, Array.from({
      length: rows
    }).map((_, i) => /*#__PURE__*/React.createElement(__ds_scope.Card, {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-row-top"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 8,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Skeleton, {
      width: "52%",
      height: 15
    }), /*#__PURE__*/React.createElement(__ds_scope.Skeleton, {
      width: "34%",
      height: 11
    })), /*#__PURE__*/React.createElement(__ds_scope.Skeleton, {
      width: 86,
      height: 20,
      radius: 999
    })), /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-fields"
    }, /*#__PURE__*/React.createElement(__ds_scope.Skeleton, {
      width: "70%",
      height: 12
    }), /*#__PURE__*/React.createElement(__ds_scope.Skeleton, {
      width: "50%",
      height: 12
    }))))));
  }
  const cls = ["lq-state", state !== "empty" ? "lq-state--" + state : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    role: state === "error" ? "alert" : undefined
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-state-glyph"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: GLYPH[state] || "inbox",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "lq-state-title"
  }, title), body ? /*#__PURE__*/React.createElement("div", {
    className: "lq-state-body"
  }, body) : null, state === "denied" && requiredRole ? /*#__PURE__*/React.createElement("span", {
    className: "lq-state-role"
  }, requiredRole) : null, actionLabel ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: state === "error" ? "outline" : "default",
    size: "sm",
    onClick: onAction
  }, state === "error" ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "refresh-cw",
    size: 14
  }) : null, actionLabel) : null);
}
Object.assign(__ds_scope, { ListState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ListState.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Alert.jsx
try { (() => {
const ICONS = {
  default: "info",
  info: "info",
  wait: "clock",
  destructive: "triangle-alert"
};
function Alert({
  variant = "default",
  icon,
  title,
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ["lq-alert", "lq-alert--" + variant, className].filter(Boolean).join(" "),
    role: "note"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    className: "lq-alert-icon",
    name: icon || ICONS[variant] || "info",
    size: 16
  }), /*#__PURE__*/React.createElement("div", null, title ? /*#__PURE__*/React.createElement("div", {
    className: "lq-alert-title"
  }, title) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "lq-alert-body"
  }, children) : null));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Alert.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  invalid,
  unit,
  className = "",
  ...rest
}) {
  const input = /*#__PURE__*/React.createElement("input", _extends({
    className: ("lq-input " + className).trim(),
    "data-invalid": invalid ? "" : undefined,
    "data-num": rest.type === "number" || rest.inputMode === "decimal" ? "" : undefined
  }, rest));
  if (!unit) return input;
  return /*#__PURE__*/React.createElement("span", {
    className: "lq-affix"
  }, input, /*#__PURE__*/React.createElement("span", {
    className: "lq-affix-unit"
  }, unit));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Input.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Label({
  optional,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    className: ("lq-label " + className).trim(),
    "data-optional": optional ? "" : undefined
  }, rest), children);
}
function FieldHint({
  invalid,
  className = "",
  children
}) {
  return /*#__PURE__*/React.createElement("p", {
    className: ("lq-field-hint " + className).trim(),
    "data-invalid": invalid ? "" : undefined
  }, children);
}
Object.assign(__ds_scope, { Label, FieldHint });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Label.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Progress.jsx
try { (() => {
function Progress({
  value = 0,
  tone = "default",
  marks = [],
  className = ""
}) {
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-progress " + className).trim(),
    "data-tone": tone,
    role: "progressbar",
    "aria-valuenow": pct
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-progress-bar",
    style: {
      inlineSize: pct + "%"
    }
  }), marks.map(m => /*#__PURE__*/React.createElement("span", {
    key: m,
    className: "lq-progress-mark",
    style: {
      insetInlineStart: Math.max(0, Math.min(100, m)) + "%"
    }
  })));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Progress.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Separator.jsx
try { (() => {
function Separator({
  orientation = "horizontal",
  className = ""
}) {
  return /*#__PURE__*/React.createElement("hr", {
    className: ("lq-sep " + className).trim(),
    "data-orientation": orientation
  });
}
Object.assign(__ds_scope, { Separator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Separator.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Switch.jsx
try { (() => {
/* shadcn/ui Switch: a button with role="switch". Saves on flip — it is not a
   form field waiting for a Save. */
function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  hint,
  className = ""
}) {
  const controlled = checked !== undefined;
  const [inner, setInner] = React.useState(!!defaultChecked);
  const on = controlled ? !!checked : inner;
  const toggle = () => {
    if (!controlled) setInner(!on);
    if (onCheckedChange) onCheckedChange(!on);
  };
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": on,
    disabled: disabled,
    className: ("lq-switch " + className).trim(),
    "data-on": on,
    "data-disabled": !!disabled,
    onClick: toggle
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-switch-track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-switch-thumb"
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "grid",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-check-text"
  }, label), hint ? /*#__PURE__*/React.createElement("span", {
    className: "lq-field-hint",
    style: {
      marginBlockStart: 0
    }
  }, hint) : null) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Switch.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Tabs.jsx
try { (() => {
function Tabs({
  value,
  onValueChange,
  tabs = [],
  variant = "pill",
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ["lq-tabs-list", variant === "underline" ? "lq-tabs-list--underline" : "", className].filter(Boolean).join(" "),
    role: "tablist"
  }, tabs.map(t => {
    const item = typeof t === "string" ? {
      value: t,
      label: t
    } : t;
    return /*#__PURE__*/React.createElement("button", {
      key: item.value,
      role: "tab",
      type: "button",
      className: "lq-tab",
      "data-active": value === item.value,
      "aria-selected": value === item.value,
      onClick: () => onValueChange && onValueChange(item.value)
    }, item.label, item.count != null ? /*#__PURE__*/React.createElement("span", {
      className: "lq-nav-count"
    }, item.count) : null);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  invalid,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    className: ("lq-textarea " + className).trim(),
    "data-invalid": invalid ? "" : undefined
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/primitives/usePresence.js
try { (() => {
/* Keeps a component mounted for the length of its exit animation.
   Nothing in Loqal should vanish on a frame: a sheet, a popover or a panel that
   disappears instantly reads as a crash on a slow phone. Pair with a
   [data-state="closed"] rule that runs the entrance keyframes in reverse. */
function usePresence(open, duration = 180) {
  const [present, setPresent] = React.useState(!!open);
  React.useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    if (!present) return;
    const t = setTimeout(() => setPresent(false), duration);
    return () => clearTimeout(t);
  }, [open, duration, present]);
  return [present, open ? "open" : "closed"];
}
Object.assign(__ds_scope, { usePresence });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/usePresence.js", error: String((e && e.message) || e) }); }

// components/overlays/Sheet.jsx
try { (() => {
/* shadcn/ui Sheet. Two placements only: bottom (actions, filters, destructive
   confirmations) and side-start (the mobile collapse of the sidebar). There is no
   centred Dialog in Loqal — a centred modal on a phone puts the confirm button
   under the thumb by accident.

   The bottom sheet is draggable: down to dismiss, up to expand. A shop owner
   holding the phone in one hand reaches the grip long before they reach a close
   button in the far corner. */
function Sheet({
  open,
  side = "bottom",
  title,
  description,
  footer,
  onClose,
  children,
  className = ""
}) {
  const [present, state] = __ds_scope.usePresence(open, 200);
  /* Consumers clear the state that feeds a sheet in the same tick they close it
     (setAdjust(null), setOpen(null)…). Without a snapshot the sheet would animate
     out as an empty, collapsed box, so hold the last content it actually had and
     keep rendering that until it is gone. */
  const last = React.useRef({
    title,
    description,
    footer,
    children
  });
  if (open) last.current = {
    title,
    description,
    footer,
    children
  };
  const shown = open ? {
    title,
    description,
    footer,
    children
  } : last.current;
  const bottom = side !== "start";
  const sheetRef = React.useRef(null);
  const drag = React.useRef(null);
  const [dy, setDy] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!open) {
      setDy(0);
      setDragging(false);
      setExpanded(false);
    }
  }, [open]);
  const onPointerDown = e => {
    if (!bottom || e.button) return;
    drag.current = {
      y: e.clientY,
      t: Date.now(),
      h: sheetRef.current ? sheetRef.current.offsetHeight : 400
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = e => {
    if (!drag.current) return;
    const raw = e.clientY - drag.current.y;
    /* Downward is free. Upward is rubber-banded, and only until it expands. */
    setDy(raw >= 0 ? raw : expanded ? raw / 6 : Math.max(raw / 2.2, -90));
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const {
      h,
      t
    } = drag.current;
    const velocity = dy / Math.max(1, Date.now() - t);
    drag.current = null;
    setDragging(false);
    if (dy > Math.min(140, h * 0.28) || velocity > 0.7) {
      setDy(0);
      if (onClose) onClose();
    } else if (dy < -40 && !expanded) {
      setExpanded(true);
      setDy(0);
    } else {
      setDy(0);
    }
  };
  if (!present) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lq-overlay",
    "data-state": state,
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    ref: sheetRef,
    "data-state": state,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": typeof shown.title === "string" ? shown.title : undefined,
    className: ["lq-sheet", "lq-sheet--" + (bottom ? "bottom" : "side"), dragging ? "lq-sheet--dragging" : "", expanded ? "lq-sheet--expanded" : "", className].filter(Boolean).join(" "),
    style: dy ? {
      transform: "translateY(" + dy + "px)"
    } : undefined
  }, bottom ? /*#__PURE__*/React.createElement("div", {
    className: "lq-sheet-handle",
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    onPointerCancel: onPointerUp,
    role: "separator",
    "aria-label": "Drag to resize or dismiss"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-sheet-grip"
  })) : null, shown.title || shown.description ? /*#__PURE__*/React.createElement("div", {
    className: "lq-sheet-header"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minInlineSize: 0
    }
  }, shown.title ? /*#__PURE__*/React.createElement("div", {
    className: "lq-sheet-title"
  }, shown.title) : null, shown.description ? /*#__PURE__*/React.createElement("div", {
    className: "lq-sheet-desc"
  }, shown.description) : null), onClose ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    size: "icon",
    "aria-label": "Close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  })) : null)) : null, shown.children ? /*#__PURE__*/React.createElement("div", {
    className: "lq-sheet-body"
  }, shown.children) : null, shown.footer ? /*#__PURE__*/React.createElement("div", {
    className: "lq-sheet-footer"
  }, shown.footer) : null));
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Sheet.jsx", error: String((e && e.message) || e) }); }

// components/overlays/DestructiveSheet.jsx
try { (() => {
/* Composed from shadcn Sheet + Button (destructive) + Button (ghost).
   The consequences are written out because the device is a phone in a busy shop
   and the user is being asked to undo something a customer is waiting on. */
function DestructiveSheet({
  open,
  title,
  description,
  consequences = [],
  confirmLabel = "Confirm",
  cancelLabel = "Keep as it is",
  onConfirm,
  onClose,
  children
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Sheet, {
    open: open,
    side: "bottom",
    title: title,
    description: description,
    onClose: onClose,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "destructive",
      size: "tap",
      onClick: onConfirm
    }, confirmLabel), /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: "ghost",
      size: "tap",
      onClick: onClose
    }, cancelLabel))
  }, consequences.length ? /*#__PURE__*/React.createElement("ul", {
    className: "lq-sheet-consequences"
  }, consequences.map((c, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", null, c)))) : null, children);
}
Object.assign(__ds_scope, { DestructiveSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/DestructiveSheet.jsx", error: String((e && e.message) || e) }); }

// components/primitives/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* shadcn/ui Select: a trigger button and a popover listbox, not a native
   <select>. Keyboard: Enter/Space/ArrowDown opens, arrows move, Enter picks,
   Escape closes. */
function Select({
  value,
  defaultValue,
  onValueChange,
  options = [],
  placeholder = "Select",
  disabled,
  invalid,
  id,
  className = "",
  ...rest
}) {
  const items = options.map(o => typeof o === "string" ? {
    value: o,
    label: o
  } : o);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const current = controlled ? value : inner;
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  /* The panel is position:fixed and measured from the trigger, not absolutely
     positioned inside it. Selects live inside scrolling sheet bodies all over the
     phone consoles, and an absolutely-positioned panel gets clipped by them. */
  const [box, setBox] = React.useState(null);
  const [panelPresent, panelState] = __ds_scope.usePresence(open, 140);
  const ref = React.useRef(null);
  const triggerRef = React.useRef(null);
  const selected = items.find(i => i.value === current);
  const ITEM = 36,
    PAD = 4,
    MAXH = 238;
  const measure = React.useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const idx = items.findIndex(i => i.value === current);
    const full = items.length * ITEM + PAD * 2;
    const h = Math.min(MAXH, full);
    /* With a value chosen, open like a native picker: the selected row sits over
       the trigger, so the eye does not have to travel to find where it was.
       With nothing chosen there is nothing to align to, so drop below. */
    let top = idx >= 0 ? r.top - (Math.min(idx, Math.floor((h - ITEM) / ITEM)) * ITEM + PAD) : r.bottom + 4;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    setBox({
      insetInlineStart: r.left,
      inlineSize: r.width,
      top,
      blockSize: h,
      maxBlockSize: h,
      scrollTo: idx
    });
  }, [items, current]);
  const contentRef = React.useRef(null);
  React.useEffect(() => {
    if (!open || !box || !contentRef.current) return;
    const idx = box.scrollTo;
    if (idx > 0) contentRef.current.scrollTop = Math.max(0, idx * ITEM - (box.blockSize - ITEM) / 2);
  }, [open, box && box.scrollTo, box && box.blockSize]);
  React.useEffect(() => {
    if (!open) return;
    measure();
    const away = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);
  const pick = v => {
    if (!controlled) setInner(v);
    if (onValueChange) onValueChange(v);
    setOpen(false);
  };
  const onKeyDown = e => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setHi(Math.max(0, items.findIndex(i => i.value === current)));
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi(h => Math.min(items.length - 1, h + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi(h => Math.max(0, h - 1));
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (items[hi]) pick(items[hi].value);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-select " + className).trim(),
    ref: ref
  }, /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    ref: triggerRef,
    id: id,
    role: "combobox",
    "aria-expanded": open,
    "aria-haspopup": "listbox",
    disabled: disabled,
    "data-invalid": invalid ? "" : undefined,
    "data-placeholder": !selected,
    className: "lq-select-trigger",
    onClick: () => setOpen(o => !o),
    onKeyDown: onKeyDown
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "lq-select-value"
  }, selected ? selected.label : placeholder), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    className: "lq-select-chev",
    name: "chevron-down",
    size: 16
  })), panelPresent && box ? /*#__PURE__*/React.createElement("div", {
    ref: contentRef,
    className: "lq-select-content",
    "data-state": panelState,
    role: "listbox",
    style: {
      insetInlineStart: box.insetInlineStart,
      inlineSize: box.inlineSize,
      top: box.top,
      blockSize: box.blockSize,
      maxBlockSize: box.maxBlockSize
    }
  }, items.map((i, n) => /*#__PURE__*/React.createElement("button", {
    key: i.value,
    type: "button",
    role: "option",
    "aria-selected": i.value === current,
    "data-selected": i.value === current,
    "data-highlighted": n === hi,
    className: "lq-select-item",
    onPointerEnter: () => setHi(n),
    onClick: () => pick(i.value)
  }, /*#__PURE__*/React.createElement("span", null, i.label), i.value === current ? /*#__PURE__*/React.createElement("span", {
    className: "lq-select-check"
  }) : null))) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/primitives/Select.jsx", error: String((e && e.message) || e) }); }

// components/shell/AppShell.jsx
try { (() => {
/* shadcn Sidebar at lg, collapsing to a shadcn Sheet (side start) below it.
   The console label is always visible: three consoles share this shell and a
   user must never have to guess which one they are in. */
function Nav({
  groups = [],
  active,
  onNavigate
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "lq-nav"
  }, groups.map(g => /*#__PURE__*/React.createElement(React.Fragment, {
    key: g.label || "g"
  }, g.label ? /*#__PURE__*/React.createElement("div", {
    className: "lq-nav-group"
  }, g.label) : null, g.items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    type: "button",
    className: "lq-nav-item",
    "data-active": active === it.id,
    onClick: () => onNavigate && onNavigate(it.id)
  }, it.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    className: "lq-nav-icon",
    name: it.icon,
    size: 16
  }) : null, /*#__PURE__*/React.createElement("span", null, it.label), it.count != null ? it.urgent ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "count",
    style: {
      marginInlineStart: "auto"
    }
  }, it.count) : /*#__PURE__*/React.createElement("span", {
    className: "lq-nav-count"
  }, it.count) : null)))));
}
function AppShell({
  console: consoleName,
  title,
  groups = [],
  active,
  onNavigate,
  tabs = [],
  topbarActions,
  preferences,
  actionBar,
  children,
  className = ""
}) {
  const [navOpen, setNavOpen] = React.useState(false);
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const brand = /*#__PURE__*/React.createElement("div", {
    className: "lq-brandmark"
  }, /*#__PURE__*/React.createElement("span", null, "Loqal"), consoleName ? /*#__PURE__*/React.createElement("span", {
    className: "lq-brandmark-console"
  }, consoleName) : null);
  return /*#__PURE__*/React.createElement("div", {
    className: ("lq-shell " + className).trim()
  }, /*#__PURE__*/React.createElement("header", {
    className: "lq-topbar"
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    size: "icon",
    "aria-label": "Menu",
    onClick: () => setNavOpen(true)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "menu",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "lq-topbar-title"
  }, title), topbarActions, preferences ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    size: "icon",
    "aria-label": "Preferences",
    onClick: () => setPrefsOpen(true)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "settings-2",
    size: 18
  })) : null), /*#__PURE__*/React.createElement("div", {
    className: "lq-shell-body"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "lq-sidebar"
  }, brand, /*#__PURE__*/React.createElement(Nav, {
    groups: groups,
    active: active,
    onNavigate: onNavigate
  }), preferences ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "lq-nav-item lq-nav-item--foot",
    onClick: () => setPrefsOpen(true)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    className: "lq-nav-icon",
    name: "settings-2",
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Preferences")) : null), /*#__PURE__*/React.createElement("div", {
    className: "lq-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-content"
  }, children), actionBar, tabs.length ? /*#__PURE__*/React.createElement("nav", {
    className: "lq-tabbar"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    type: "button",
    className: "lq-tabbar-item",
    "data-active": active === t.id,
    onClick: () => onNavigate && onNavigate(t.id)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", null, t.label), t.count ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    variant: "count",
    style: {
      position: "absolute",
      insetBlockStart: 4,
      insetInlineEnd: "22%"
    }
  }, t.count) : null))) : null)), /*#__PURE__*/React.createElement(__ds_scope.Sheet, {
    open: prefsOpen,
    side: "bottom",
    title: "Preferences",
    description: "Language, role and appearance. Drag the sheet down to dismiss it.",
    onClose: () => setPrefsOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--space-4)",
      paddingBlockEnd: "var(--space-4)"
    }
  }, preferences)), /*#__PURE__*/React.createElement(__ds_scope.Sheet, {
    open: navOpen,
    side: "start",
    onClose: () => setNavOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-3)"
    }
  }, brand, /*#__PURE__*/React.createElement(Nav, {
    groups: groups,
    active: active,
    onNavigate: id => {
      setNavOpen(false);
      onNavigate && onNavigate(id);
    }
  }))));
}
Object.assign(__ds_scope, { AppShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-console/AdminApp.jsx
try { (() => {
const {
  AppShell,
  Button,
  Icon
} = window.LoqalDesignSystem_994dc4;
const GROUPS = [{
  label: "Brands",
  items: [{
    id: "applications",
    label: "Applications",
    icon: "inbox",
    count: 3,
    urgent: true
  }, {
    id: "brand",
    label: "Brands",
    icon: "store",
    count: 146
  }, {
    id: "catalog",
    label: "Moderation",
    icon: "boxes",
    count: 7
  }]
}, {
  label: "Money",
  items: [{
    id: "settlement",
    label: "Settlement runs",
    icon: "wallet",
    count: 2,
    urgent: true
  }, {
    id: "orders",
    label: "All orders",
    icon: "package"
  }]
}, {
  label: "Platform",
  items: [{
    id: "tryon",
    label: "Try-on",
    icon: "sparkles"
  }, {
    id: "categories",
    label: "Categories",
    icon: "folder-tree"
  }, {
    id: "settings",
    label: "Settings",
    icon: "settings"
  }]
}];
const TITLES = {
  applications: "Applications",
  brand: "Nefertari Leather",
  settlement: "Settlement runs",
  tryon: "Try-on"
};
function AdminApp({
  preferences,
  locale
}) {
  const data = window.ADMIN_DATA;
  const [screen, setScreen] = React.useState("applications");
  return /*#__PURE__*/React.createElement(AppShell, {
    console: "Admin",
    title: TITLES[screen] || "Loqal",
    groups: GROUPS,
    active: screen,
    onNavigate: setScreen,
    preferences: preferences
  }, screen === "applications" ? /*#__PURE__*/React.createElement(window.ApplicationsScreen, {
    data: data,
    locale: locale
  }) : null, screen === "brand" ? /*#__PURE__*/React.createElement(window.BrandDetailScreen, {
    data: data,
    locale: locale
  }) : null, screen === "settlement" ? /*#__PURE__*/React.createElement(window.SettlementScreen, {
    data: data,
    locale: locale
  }) : null, screen === "tryon" ? /*#__PURE__*/React.createElement(window.TryOnScreen, {
    data: data,
    locale: locale
  }) : null, ["catalog", "orders", "categories", "settings"].includes(screen) ? /*#__PURE__*/React.createElement(window.NotDrawn, {
    screen: screen
  }) : null);
}
function NotDrawn({
  screen
}) {
  const {
    ListState
  } = window.LoqalDesignSystem_994dc4;
  return /*#__PURE__*/React.createElement(ListState, {
    state: "empty",
    title: "Not drawn in this kit",
    body: "The " + screen + " screen is in the spec inventory but is not part of this recreation."
  });
}
Object.assign(window, {
  AdminApp,
  NotDrawn
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-console/AdminApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-console/ApplicationsScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  ResponsiveList,
  StatusPill,
  Badge,
  Sheet,
  Textarea,
  Label,
  DestructiveSheet,
  Separator
} = window.LoqalDesignSystem_994dc4;
function ApplicationsScreen({
  data,
  locale
}) {
  const [reject, setReject] = React.useState(null);
  const [approve, setApprove] = React.useState(null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lq-kpis"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Waiting"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "3"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "oldest 3 days")), /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Active brands"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "146"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "2 suspended")), /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "GMV \xB7 30d"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "1.24M"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "EGP")), /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Runs to settle"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "2"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "both pending"))), /*#__PURE__*/React.createElement("div", {
    className: "lq-section-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lq-section-title"
  }, "Applications"), /*#__PURE__*/React.createElement("div", {
    className: "lq-section-sub"
  }, "Approving creates the brand and its owner login. Commercial terms are set straight after."))), /*#__PURE__*/React.createElement(ResponsiveList, {
    columns: [{
      key: "brand",
      label: "Brand",
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          display: "grid",
          gap: 1
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 500,
          whiteSpace: "nowrap"
        }
      }, r.brand), /*#__PURE__*/React.createElement("span", {
        className: "lq-section-sub",
        dir: "rtl",
        style: {
          textAlign: "start"
        }
      }, r.ar))
    }, {
      key: "area",
      label: "Area",
      meta: true
    }, {
      key: "cat",
      label: "Category"
    }, {
      key: "products",
      label: "Photos in",
      num: true
    }, {
      key: "by",
      label: "Signed up by"
    }, {
      key: "when",
      label: "Received"
    }, {
      key: "act",
      label: "",
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          display: "flex",
          gap: 6,
          justifyContent: "flex-end"
        }
      }, /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        onClick: e => {
          e.stopPropagation();
          setApprove(r);
        }
      }, "Approve"), /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outline",
        onClick: e => {
          e.stopPropagation();
          setReject(r);
        }
      }, "Reject"))
    }],
    rows: data.applications,
    locale: locale
  }), /*#__PURE__*/React.createElement(Sheet, {
    open: !!approve,
    title: approve ? "Approve " + approve.brand : "",
    description: "Set the commercial terms now. The brand can see them but cannot change them.",
    onClose: () => setApprove(null),
    footer: /*#__PURE__*/React.createElement(Button, {
      size: "tap",
      onClick: () => setApprove(null)
    }, "Approve and create the brand")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10,
      paddingBlockEnd: 12
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub"
  }, "Free until, monthly fee, per-order charge and settlement cadence are set on the terms screen that opens next."))), /*#__PURE__*/React.createElement(DestructiveSheet, {
    open: !!reject,
    onClose: () => setReject(null),
    onConfirm: () => setReject(null),
    title: reject ? "Reject " + reject.brand + "?" : "",
    description: "The reason is sent to the applicant and kept on the application.",
    consequences: ["The applicant is emailed the reason you write below.", "No brand and no login are created.", "The application stays on file and can be re-opened."],
    confirmLabel: "Reject the application",
    cancelLabel: "Keep it in the queue"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBlockEnd: 12
    }
  }, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "rej"
  }, "Reason"), /*#__PURE__*/React.createElement(Textarea, {
    id: "rej",
    rows: 3,
    placeholder: "Written to the applicant, in their language"
  }))));
}
Object.assign(window, {
  ApplicationsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-console/ApplicationsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-console/BrandDetailScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Icon,
  StatusPill,
  Badge,
  MoneyRow,
  Input,
  Label,
  Select,
  Switch,
  Separator,
  Alert,
  Avatar,
  DestructiveSheet,
  FieldHint,
  Tabs
} = window.LoqalDesignSystem_994dc4;
function Row({
  label,
  children,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Label, null, label), children, hint ? /*#__PURE__*/React.createElement(FieldHint, null, hint) : null);
}
function BrandDetailScreen({
  data,
  locale
}) {
  const brand = data.brands[0];
  const [promoted, setPromoted] = React.useState(brand.promoted);
  const [suspend, setSuspend] = React.useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardContent, {
    style: {
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 14,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    square: true,
    size: "lg",
    name: brand.name
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minInlineSize: 200
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xl)",
      fontWeight: 600,
      letterSpacing: "-0.02em"
    }
  }, brand.name), /*#__PURE__*/React.createElement(StatusPill, {
    enumName: "BrandStatus",
    value: brand.status,
    locale: locale
  }), promoted ? /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, "Promoted") : null), /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-meta"
  }, /*#__PURE__*/React.createElement("span", null, brand.area), /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, brand.products, " products"), /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, "GMV ", brand.gmv, " EGP"))), /*#__PURE__*/React.createElement(MoneyRow, {
    amount: brand.balance,
    variant: "row",
    locale: locale,
    creditLabel: "We owe " + brand.name,
    debitLabel: brand.name + " owes us"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--space-4)",
      gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))"
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Commercial terms"), /*#__PURE__*/React.createElement(CardDescription, null, "Set here, read-only to the brand.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Free until"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "date",
    defaultValue: "2026-11-01"
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Monthly fee"
  }, /*#__PURE__*/React.createElement(Input, {
    inputMode: "decimal",
    unit: "EGP",
    defaultValue: "350.00"
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Per-order charge"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "PERCENT",
      label: "Percent"
    }, {
      value: "FLAT",
      label: "Flat"
    }],
    defaultValue: "PERCENT"
  }), /*#__PURE__*/React.createElement(Input, {
    inputMode: "decimal",
    unit: "%",
    defaultValue: "12.00"
  }))), /*#__PURE__*/React.createElement(Row, {
    label: "Settlement cadence",
    hint: "Anchor day 1 and 16. Cash orders reverse the direction."
  }, /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "SEMI",
      label: "Twice a month"
    }, {
      value: "MONTHLY",
      label: "Monthly"
    }, {
      value: "WEEKLY",
      label: "Weekly"
    }],
    defaultValue: "SEMI"
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Settlement method"
  }, /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "INSTAPAY",
      label: "Instapay"
    }, {
      value: "BANK",
      label: "Bank transfer"
    }, {
      value: "CASH",
      label: "Cash"
    }],
    defaultValue: "INSTAPAY"
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Payout account"
  }, /*#__PURE__*/React.createElement(Input, {
    "data-num": true,
    defaultValue: "01022884471"
  })))), /*#__PURE__*/React.createElement(CardFooter, null, /*#__PURE__*/React.createElement(Button, null, "Save terms"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Discard"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--space-4)",
      alignContent: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Placement"), /*#__PURE__*/React.createElement(CardDescription, null, "Selling placement is fine. Selling the appearance of trust is not.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: promoted,
    onCheckedChange: setPromoted,
    label: "Promoted placement",
    hint: "Shoppers see a Promoted label wherever this brand is ranked up."
  }), /*#__PURE__*/React.createElement(Row, {
    label: "Featured until"
  }, /*#__PURE__*/React.createElement(Input, {
    type: "date",
    defaultValue: "2026-09-30"
  })), /*#__PURE__*/React.createElement(Row, {
    label: "Sort order",
    hint: "Lower sorts first within a category."
  }, /*#__PURE__*/React.createElement(Input, {
    inputMode: "decimal",
    defaultValue: "20"
  }))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Reputation"), /*#__PURE__*/React.createElement(CardDescription, null, "Manual score, 0\u2013100. Badges are separate.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: "Score",
    hint: "Last set by Hala Nabil, 11 Aug 16:04."
  }, /*#__PURE__*/React.createElement(Input, {
    inputMode: "decimal",
    defaultValue: "78"
  })), /*#__PURE__*/React.createElement(Separator, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: "secondary"
  }, "Computed"), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, "Fast shipper \u2014 24 delivered in 60 days")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Badge, null, "Verified"), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, "Issued by you, 2 Aug"), /*#__PURE__*/React.createElement(Button, {
    variant: "link",
    size: "sm",
    style: {
      marginInlineStart: "auto"
    }
  }, "Revoke"))), /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "Computed badges cannot be issued"
  }, "Only verified badges are yours to grant. Computed badges are earned from delivered orders.")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Status")), /*#__PURE__*/React.createElement(CardFooter, null, /*#__PURE__*/React.createElement(Button, {
    variant: "destructive",
    onClick: () => setSuspend(true)
  }, "Suspend brand"))))), /*#__PURE__*/React.createElement(DestructiveSheet, {
    open: suspend,
    onClose: () => setSuspend(false),
    onConfirm: () => setSuspend(false),
    title: "Suspend " + brand.name + "?",
    description: "Suspension hides the shop from shoppers. It does not stop work already in progress.",
    consequences: ["The shop and all 41 products stop appearing to shoppers immediately.", "The 6 orders already in flight still complete, and still settle.", "The owner keeps their login and can see the money screens.", "Nothing is deleted and the brand can be reactivated."],
    confirmLabel: "Suspend the brand",
    cancelLabel: "Leave it active"
  }));
}
Object.assign(window, {
  BrandDetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-console/BrandDetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-console/SettlementScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Icon,
  ResponsiveList,
  StatusPill,
  Badge,
  MoneyRow,
  Separator,
  Sheet,
  Alert,
  ListState
} = window.LoqalDesignSystem_994dc4;

/* A12 — the screen the business runs on. A wrong figure has to be obvious before
   the button is pressed, so the run opens with its period, direction, method,
   destination account and the ledger lines behind the number, all on one screen. */
function SettlementScreen({
  data,
  locale
}) {
  const [open, setOpen] = React.useState(null);
  const total = data.runLines.reduce((s, l) => s + l.amount, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Alert, {
    variant: "wait",
    title: "Two runs are waiting on a human"
  }, "Nothing moves money on its own. Each run is marked sent or received by a person, and the mark is logged with their name."), /*#__PURE__*/React.createElement(ResponsiveList, {
    columns: [{
      key: "brand",
      label: "Brand"
    }, {
      key: "period",
      label: "Period",
      meta: true
    }, {
      key: "dir",
      label: "Direction",
      render: r => /*#__PURE__*/React.createElement(Badge, {
        variant: "outline"
      }, r.dir === "WE_PAY" ? "We pay" : "They pay")
    }, {
      key: "method",
      label: "Method"
    }, {
      key: "lines",
      label: "Ledger lines",
      num: true
    }, {
      key: "status",
      label: "Status",
      render: r => /*#__PURE__*/React.createElement(StatusPill, {
        enumName: "SettlementStatus",
        value: r.status,
        locale: locale
      })
    }, {
      key: "amount",
      label: "Amount",
      num: true,
      render: (r, l) => /*#__PURE__*/React.createElement(MoneyRow, {
        amount: r.amount,
        variant: "inline",
        locale: l
      })
    }],
    rows: data.runs,
    locale: locale,
    onRowClick: setOpen
  }), /*#__PURE__*/React.createElement(Sheet, {
    open: !!open,
    title: open ? open.brand + " · " + open.period : "",
    description: "Check the figure against the lines before you mark it.",
    onClose: () => setOpen(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "tap",
      onClick: () => setOpen(null)
    }, open && open.dir === "WE_PAY" ? "Mark sent" : "Mark received"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "tap",
      onClick: () => setOpen(null)
    }, "Not yet"))
  }, open ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 14,
      paddingBlockEnd: 12
    }
  }, /*#__PURE__*/React.createElement(MoneyRow, {
    amount: open.amount,
    locale: locale,
    creditLabel: "We pay " + open.brand,
    debitLabel: open.brand + " pays us",
    note: open.lines + " ledger lines · " + open.period
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Method"), /*#__PURE__*/React.createElement("span", null, open.method)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Account"), /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, open.account))), /*#__PURE__*/React.createElement(Separator, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Behind the number"), data.runLines.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)"
    }
  }, l.what, " ", /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub",
    "data-num": true
  }, "\xD7 ", l.n)), /*#__PURE__*/React.createElement(MoneyRow, {
    amount: l.amount,
    variant: "inline",
    locale: locale
  }))), /*#__PURE__*/React.createElement(Separator, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      fontSize: "var(--text-sm)"
    }
  }, "Sum of lines"), /*#__PURE__*/React.createElement(MoneyRow, {
    amount: total,
    variant: "inline",
    locale: locale
  })), /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub"
  }, "Delivery fees are not in this list and never enter the ledger."))) : null));
}
Object.assign(window, {
  SettlementScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-console/SettlementScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-console/TryOnScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  Progress,
  Badge,
  Input,
  Label,
  Select,
  Switch,
  Alert,
  Separator,
  ResponsiveList
} = window.LoqalDesignSystem_994dc4;

/* A14 — the budget governor drawn as a gauge with both thresholds marked, not as
   a number in a settings form. 85% drops to the fallback model, 100% serves cache. */
function TryOnScreen({
  data,
  locale
}) {
  const used = 78;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Try-on budget \xB7 August"), /*#__PURE__*/React.createElement(CardDescription, null, "At 85% the primary model is swapped for the fallback. At 100% only cached results are served.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-3xl)",
      fontWeight: 600,
      letterSpacing: "-0.02em"
    }
  }, used, "%"), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub",
    "data-num": true
  }, "9,360.00 of 12,000.00 EGP")), /*#__PURE__*/React.createElement(Progress, {
    value: used,
    tone: used >= 85 ? "bad" : "wait",
    marks: [85, 100]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, "85% \xB7 fallback model"), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, "100% \xB7 cache only"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: "var(--space-4)",
      gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))"
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Models"), /*#__PURE__*/React.createElement(CardDescription, null, "Primary runs until the budget governor steps in.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Primary model"), /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "p1",
      label: "try-on-hq"
    }, {
      value: "p2",
      label: "try-on-lite"
    }],
    defaultValue: "p1"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Fallback model"), /*#__PURE__*/React.createElement(Select, {
    options: [{
      value: "p2",
      label: "try-on-lite"
    }],
    defaultValue: "p2"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Monthly budget"), /*#__PURE__*/React.createElement(Input, {
    inputMode: "decimal",
    unit: "EGP",
    defaultValue: "12000.00"
  })), /*#__PURE__*/React.createElement(Switch, {
    checked: true,
    label: "Serve cached results after the budget is spent",
    hint: "Off means try-on disappears from the storefront instead."
  })))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Usage \xB7 last 7 days")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10
    }
  }, [["Mon", 62], ["Tue", 71], ["Wed", 48], ["Thu", 88], ["Fri", 96], ["Sat", 74], ["Sun", 55]].map(([d, v]) => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key",
    style: {
      inlineSize: 34
    }
  }, d), /*#__PURE__*/React.createElement(Progress, {
    value: v
  }), /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)",
      inlineSize: 40,
      textAlign: "end"
    }
  }, v))))))));
}
Object.assign(window, {
  TryOnScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-console/TryOnScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin-console/data.js
try { (() => {
window.ADMIN_DATA = {
  applications: [{
    id: "a1",
    brand: "Nefertari Leather",
    ar: "نفرتاري للجلود",
    area: "Sayeda Zeinab, Cairo",
    cat: "Bags & leather",
    when: "Today 09:12",
    products: 41,
    by: "SALES · Omar Fathy"
  }, {
    id: "a2",
    brand: "Bint El Sudan Home",
    ar: "بنت السودان هوم",
    area: "Damanhour",
    cat: "Home",
    when: "Yesterday",
    products: 12,
    by: "Self-serve"
  }, {
    id: "a3",
    brand: "Zeyad Ceramics",
    ar: "زياد سيراميك",
    area: "Fustat, Cairo",
    cat: "Home",
    when: "12 Aug",
    products: 6,
    by: "SALES · Hala Nabil"
  }],
  brands: [{
    id: "b1",
    name: "Nefertari Leather",
    status: "ACTIVE",
    area: "Cairo",
    gmv: "184,220.00",
    balance: 4820.5,
    products: 41,
    score: 78,
    promoted: true,
    badges: 2
  }, {
    id: "b2",
    name: "Sekem Weaves",
    status: "ACTIVE",
    area: "Sharqia",
    gmv: "96,410.00",
    balance: -1290,
    products: 23,
    score: 64,
    promoted: false,
    badges: 1
  }, {
    id: "b3",
    name: "Maadi Ceramics",
    status: "SUSPENDED",
    area: "Cairo",
    gmv: "12,050.00",
    balance: 0,
    products: 8,
    score: 31,
    promoted: false,
    badges: 0
  }, {
    id: "b4",
    name: "Bahari Soap",
    status: "PENDING",
    area: "Alexandria",
    gmv: "—",
    balance: 0,
    products: 0,
    score: 0,
    promoted: false,
    badges: 0
  }],
  runs: [{
    id: "r1",
    brand: "Nefertari Leather",
    period: "1–15 Aug",
    dir: "WE_PAY",
    status: "PENDING",
    amount: 4820.5,
    method: "Instapay",
    account: "01022884471",
    lines: 214
  }, {
    id: "r2",
    brand: "Sekem Weaves",
    period: "1–15 Aug",
    dir: "THEY_PAY",
    status: "PENDING",
    amount: -1290,
    method: "Bank transfer",
    account: "NBE ****3391",
    lines: 88
  }, {
    id: "r3",
    brand: "Maadi Ceramics",
    period: "16–31 Jul",
    dir: "WE_PAY",
    status: "SENT",
    amount: 612.75,
    method: "Instapay",
    account: "01277451188",
    lines: 31
  }, {
    id: "r4",
    brand: "Nefertari Leather",
    period: "16–31 Jul",
    dir: "THEY_PAY",
    status: "RECEIVED",
    amount: -2340,
    method: "Cash",
    account: "Collected in shop",
    lines: 190
  }],
  runLines: [{
    id: "x1",
    what: "Card orders settled to Loqal",
    n: 31,
    amount: 6420.00
  }, {
    id: "x2",
    what: "Commission on delivered orders (12%)",
    n: 31,
    amount: -770.40
  }, {
    id: "x3",
    what: "Cash orders collected by the brand",
    n: 14,
    amount: -479.10
  }, {
    id: "x4",
    what: "Monthly fee — August",
    n: 1,
    amount: -350.00
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin-console/data.js", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/BrandApp.jsx
try { (() => {
const {
  AppShell,
  Button,
  Icon,
  Badge,
  Sheet,
  Switch
} = window.LoqalDesignSystem_994dc4;
const GROUPS = t => [{
  items: [{
    id: "today",
    label: t.today,
    icon: "sun"
  }, {
    id: "orders",
    label: t.orders,
    icon: "package",
    count: 2,
    urgent: true
  }, {
    id: "catalog",
    label: t.catalog,
    icon: "boxes",
    count: 5
  }, {
    id: "chat",
    label: t.chat,
    icon: "message-square",
    count: 2,
    urgent: true
  }]
}, {
  label: t.ownerOnly,
  items: [{
    id: "money",
    label: t.money,
    icon: "wallet"
  }, {
    id: "settings",
    label: t.settings,
    icon: "settings"
  }]
}];
const TABS = t => [{
  id: "today",
  label: t.today,
  icon: "sun"
}, {
  id: "orders",
  label: t.orders,
  icon: "package",
  count: 2
}, {
  id: "catalog",
  label: t.catalog,
  icon: "boxes"
}, {
  id: "chat",
  label: t.chat,
  icon: "message-square",
  count: 2
}, {
  id: "money",
  label: t.money,
  icon: "wallet"
}];
const COPY = {
  en: {
    today: "Today",
    orders: "Orders",
    catalog: "Catalog",
    chat: "Chat",
    money: "Money",
    settings: "Settings",
    ownerOnly: "Owner only"
  },
  ar: {
    today: "اليوم",
    orders: "الطلبات",
    catalog: "الكتالوج",
    chat: "المحادثات",
    money: "الحساب",
    settings: "الإعدادات",
    ownerOnly: "للمالك فقط"
  }
};
const TITLES = {
  en: {
    today: "Today",
    orders: "Orders",
    catalog: "Catalog",
    chat: "Chat",
    money: "Money",
    bulk: "New photos",
    order: "Order",
    thread: "Thread"
  },
  ar: {
    today: "اليوم",
    orders: "الطلبات",
    catalog: "الكتالوج",
    chat: "المحادثات",
    money: "الحساب",
    bulk: "صور جديدة",
    order: "طلب",
    thread: "محادثة"
  }
};
function BrandApp({
  preferences,
  locale,
  role
}) {
  const data = window.BRAND_DATA;
  const [screen, setScreen] = React.useState("today");
  const [order, setOrder] = React.useState(null);
  const [thread, setThread] = React.useState(null);
  const t = COPY[locale];
  const titles = TITLES[locale];
  const go = id => {
    setOrder(null);
    setThread(null);
    setScreen(id);
  };
  const view = order ? "order" : thread ? "thread" : screen;
  const back = () => {
    setOrder(null);
    setThread(null);
    if (screen === "bulk") setScreen("catalog");
  };
  const showBack = !!order || !!thread || screen === "bulk";
  return /*#__PURE__*/React.createElement(AppShell, {
    console: locale === "ar" ? "المتجر" : "Brand",
    title: showBack ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "icon",
      "aria-label": "Back",
      onClick: back,
      style: {
        marginInlineStart: -8
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrow-left",
      size: 18,
      className: "lq-rl-chev"
    })), /*#__PURE__*/React.createElement("span", null, order ? titles.order + " " + order.ref : thread ? thread.who : titles.bulk)) : titles[screen],
    groups: GROUPS(t),
    tabs: TABS(t),
    active: screen,
    onNavigate: go,
    preferences: preferences
  }, view === "today" ? /*#__PURE__*/React.createElement(window.TodayScreen, {
    data: data,
    locale: locale,
    onOpenOrder: setOrder
  }) : null, view === "orders" ? /*#__PURE__*/React.createElement(window.OrdersScreen, {
    data: data,
    locale: locale,
    onOpenOrder: setOrder
  }) : null, view === "order" ? /*#__PURE__*/React.createElement(window.OrderDetail, {
    order: order,
    lines: data.lines,
    locale: locale,
    onBack: back,
    onConfirm: back
  }) : null, view === "catalog" ? /*#__PURE__*/React.createElement(window.CatalogScreen, {
    data: data,
    locale: locale,
    onBulkDrop: () => setScreen("bulk")
  }) : null, view === "bulk" ? /*#__PURE__*/React.createElement(window.BulkDrop, {
    data: data,
    onDone: () => setScreen("catalog")
  }) : null, view === "chat" ? /*#__PURE__*/React.createElement(window.ChatScreen, {
    data: data,
    locale: locale,
    thread: null,
    onOpen: setThread
  }) : null, view === "thread" ? /*#__PURE__*/React.createElement(window.ChatScreen, {
    data: data,
    locale: locale,
    thread: thread,
    onOpen: setThread
  }) : null, view === "money" ? /*#__PURE__*/React.createElement(window.MoneyScreen, {
    data: data,
    locale: locale,
    role: role
  }) : null, view === "settings" ? /*#__PURE__*/React.createElement(window.MoneyScreen, {
    data: data,
    locale: locale,
    role: role
  }) : null);
}
Object.assign(window, {
  BrandApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/BrandApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/BulkDrop.jsx
try { (() => {
const {
  Card,
  Button,
  Icon,
  Input,
  Badge,
  MobileActionBar,
  Progress,
  Alert
} = window.LoqalDesignSystem_994dc4;

/* B12 — the screen that wins brands. 40 photos in, a draft each, then bulk data
   entry in a grid. Two fields per photo and nothing else on screen. */
function BulkDrop({
  data,
  onDone
}) {
  const [items, setItems] = React.useState(data.drops);
  const filled = items.filter(i => i.name && i.price).length;
  const set = (id, key, value) => setItems(xs => xs.map(x => x.id === id ? {
    ...x,
    [key]: value
  } : x));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: items.length + " photos, " + items.length + " drafts"
  }, "Nothing is published yet. A draft needs a name and a price before it can go live."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Filled in"), /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xs)"
    }
  }, filled, " / ", items.length)), /*#__PURE__*/React.createElement(Progress, {
    value: filled / items.length * 100
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, items.map(it => /*#__PURE__*/React.createElement(Card, {
    key: it.id,
    flat: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      padding: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-avatar lq-avatar--square lq-avatar--lg",
    style: {
      background: "var(--muted)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "grid",
      gap: 6,
      minInlineSize: 0
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Product name",
    value: it.name,
    onChange: e => set(it.id, "name", e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Price",
    inputMode: "decimal",
    unit: "EGP",
    value: it.price,
    onChange: e => set(it.id, "price", e.target.value)
  })), it.name && it.price ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--state-good-fg)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 18
  })) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--muted-foreground)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 16
  })))))), /*#__PURE__*/React.createElement(Button, {
    variant: "outline"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  }), "Add more photos"), /*#__PURE__*/React.createElement(MobileActionBar, {
    hint: filled + " of " + items.length + " ready. The rest stay as drafts."
  }, /*#__PURE__*/React.createElement(Button, {
    size: "tap",
    onClick: onDone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload",
    size: 18
  }), "Publish ", filled, " products")));
}
Object.assign(window, {
  BulkDrop
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/BulkDrop.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/CatalogScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  StatusPill,
  ResponsiveList,
  Tabs,
  Badge,
  Progress,
  Sheet,
  Select,
  Label,
  Input,
  MobileActionBar,
  Separator
} = window.LoqalDesignSystem_994dc4;
function StockBar({
  available,
  reserved
}) {
  const total = available + reserved || 1;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: available / total * 100,
    tone: available < 5 ? "wait" : "default"
  }), /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-meta"
  }, /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, available, " available"), /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, reserved, " reserved")));
}
function CatalogScreen({
  data,
  locale,
  onBulkDrop
}) {
  const [tab, setTab] = React.useState("ALL");
  const [adjust, setAdjust] = React.useState(null);
  const rows = tab === "ALL" ? data.products : data.products.filter(p => p.status === tab);
  const columns = [{
    key: "name",
    label: "Product",
    render: (r, l) => l === "ar" ? r.ar : r.name
  }, {
    key: "sub",
    label: "Variants",
    meta: true,
    render: r => r.variants + " variants"
  }, {
    key: "status",
    label: "Status",
    render: r => /*#__PURE__*/React.createElement(StatusPill, {
      enumName: "ProductStatus",
      value: r.status,
      locale: locale,
      size: "sm"
    })
  }, {
    key: "price",
    label: "Price",
    num: true,
    render: r => r.price === "\u2014" ? "\u2014" : r.price + " EGP"
  }, {
    key: "stock",
    label: "Stock",
    render: r => /*#__PURE__*/React.createElement(StockBar, {
      available: r.available,
      reserved: r.reserved
    })
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    interactive: true,
    onClick: onBulkDrop
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-state-glyph",
    style: {
      background: "var(--state-live-bg)",
      color: "var(--state-live-fg)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "camera",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minInlineSize: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-title"
  }, "Drop photos from your phone"), /*#__PURE__*/React.createElement("div", {
    className: "lq-section-sub"
  }, "Every photo becomes a draft. Fill in names and prices in a grid afterwards.")), /*#__PURE__*/React.createElement(Icon, {
    className: "lq-rl-chev",
    name: "chevron-right",
    size: 18
  }))), /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onValueChange: setTab,
    tabs: [{
      value: "ALL",
      label: "All",
      count: 5
    }, {
      value: "PUBLISHED",
      label: "Published",
      count: 3
    }, {
      value: "DRAFT",
      label: "Draft",
      count: 1
    }, {
      value: "ARCHIVED",
      label: "Archived",
      count: 1
    }]
  }), /*#__PURE__*/React.createElement(ResponsiveList, {
    columns: columns,
    rows: rows,
    locale: locale,
    renderCard: (r, l) => /*#__PURE__*/React.createElement(Card, {
      interactive: true,
      onClick: () => setAdjust(r)
    }, /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-row-top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lq-avatar lq-avatar--square lq-avatar--lg",
      style: {
        background: "var(--muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "image",
      size: 18
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minInlineSize: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-title"
    }, l === "ar" ? r.ar : r.name), /*#__PURE__*/React.createElement("div", {
      className: "lq-rl-meta"
    }, /*#__PURE__*/React.createElement("span", null, r.variants, " variants"), /*#__PURE__*/React.createElement("span", {
      "data-num": true
    }, r.price === "\u2014" ? "no price yet" : r.price + " EGP"))), /*#__PURE__*/React.createElement(StatusPill, {
      enumName: "ProductStatus",
      value: r.status,
      locale: l,
      size: "sm"
    })), r.status === "PUBLISHED" ? /*#__PURE__*/React.createElement(StockBar, {
      available: r.available,
      reserved: r.reserved
    }) : null))
  }), /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub",
    style: {
      textAlign: "center"
    }
  }, "Archived products stay forever. Past orders still point at them."), /*#__PURE__*/React.createElement(Sheet, {
    open: !!adjust,
    title: adjust ? "Adjust stock — " + adjust.name : "",
    description: "Available is stock on hand minus live reservations. It is worked out, never typed.",
    onClose: () => setAdjust(null),
    footer: /*#__PURE__*/React.createElement(Button, {
      size: "tap",
      onClick: () => setAdjust(null)
    }, "Save adjustment")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12,
      paddingBlockEnd: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    flat: true,
    style: {
      flex: 1,
      padding: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Available"), /*#__PURE__*/React.createElement("div", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-2xl)",
      fontWeight: 600
    }
  }, adjust ? adjust.available : 0)), /*#__PURE__*/React.createElement(Card, {
    flat: true,
    style: {
      flex: 1,
      padding: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Reserved"), /*#__PURE__*/React.createElement("div", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-2xl)",
      fontWeight: 600,
      color: "var(--muted-foreground)"
    }
  }, adjust ? adjust.reserved : 0))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "adj"
  }, "Change stock on hand by"), /*#__PURE__*/React.createElement(Input, {
    id: "adj",
    inputMode: "decimal",
    defaultValue: "-1",
    unit: "units"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "rsn"
  }, "Reason"), /*#__PURE__*/React.createElement(Select, {
    id: "rsn",
    placeholder: "Choose a reason",
    options: [{
      value: "DAMAGE",
      label: "Damaged"
    }, {
      value: "RECOUNT",
      label: "Recount"
    }, {
      value: "LOSS",
      label: "Lost"
    }, {
      value: "RESTOCK",
      label: "Restock"
    }]
  })), /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub"
  }, "Saved to the adjustment history with your name and the time."))));
}
Object.assign(window, {
  CatalogScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/CatalogScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/ChatScreen.jsx
try { (() => {
const {
  Card,
  Button,
  Icon,
  Badge,
  Avatar,
  Alert,
  Input,
  MobileActionBar,
  ResponsiveList
} = window.LoqalDesignSystem_994dc4;
function ChatScreen({
  data,
  locale,
  thread,
  onOpen,
  onBack
}) {
  if (thread) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Alert, {
      variant: "wait",
      title: "Unanswered for " + thread.minutes + " minutes"
    }, "At 30 minutes this thread escalates to your WhatsApp number."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 10
      }
    }, data.messages.map((m, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        justifyContent: m.from === "us" ? "flex-end" : "flex-start"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        maxInlineSize: "78%",
        background: m.from === "us" ? "var(--primary)" : "var(--card)",
        color: m.from === "us" ? "var(--primary-foreground)" : "var(--card-foreground)",
        border: m.from === "us" ? "1px solid transparent" : "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "8px 12px",
        fontSize: "var(--text-sm)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      dir: "auto"
    }, m.text), /*#__PURE__*/React.createElement("div", {
      "data-num": true,
      style: {
        fontSize: "var(--text-2xs)",
        opacity: 0.7,
        textAlign: "end",
        marginBlockStart: 2,
        fontFamily: "var(--font-mono)"
      }
    }, m.when))))), /*#__PURE__*/React.createElement(MobileActionBar, {
      secondary: /*#__PURE__*/React.createElement(Button, {
        variant: "outline",
        size: "icon",
        "aria-label": "Attach"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "paperclip",
        size: 18
      })),
      hint: "Images and PDF, up to 5 MB."
    }, /*#__PURE__*/React.createElement(Input, {
      placeholder: "Write a reply"
    })));
  }
  return /*#__PURE__*/React.createElement(ResponsiveList, {
    columns: [{
      key: "who",
      label: "Shopper"
    }, {
      key: "last",
      label: "Last message",
      meta: true
    }, {
      key: "when",
      label: "When",
      num: true
    }],
    rows: data.threads,
    locale: locale,
    onRowClick: onOpen,
    renderCard: t => /*#__PURE__*/React.createElement(Card, {
      interactive: true,
      onClick: () => onOpen(t)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "var(--space-3) var(--space-4)"
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: t.who
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minInlineSize: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        alignItems: "baseline"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "lq-rl-title",
      style: {
        flex: 1
      }
    }, t.who), /*#__PURE__*/React.createElement("span", {
      className: "lq-section-sub",
      "data-num": true,
      style: {
        fontFamily: "var(--font-mono)"
      }
    }, t.when)), /*#__PURE__*/React.createElement("div", {
      className: "lq-section-sub",
      dir: "auto",
      style: {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }
    }, t.last)), t.unread ? /*#__PURE__*/React.createElement(Badge, {
      variant: "count"
    }, t.unread) : null))
  });
}
Object.assign(window, {
  ChatScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/ChatScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/MoneyScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  MoneyRow,
  ResponsiveList,
  ListState,
  Alert,
  StatusPill,
  Separator,
  Badge
} = window.LoqalDesignSystem_994dc4;
function MoneyScreen({
  data,
  locale,
  role
}) {
  if (role !== "BRAND_OWNER") {
    return /*#__PURE__*/React.createElement(ListState, {
      state: "denied",
      title: "Only the owner can see money",
      body: "Balance, ledger, settlement runs and payout details are hidden from employees \u2014 not greyed out, absent. Ask the shop owner if you need a figure.",
      requiredRole: "BRAND_OWNER"
    });
  }
  const balance = data.ledger.reduce((s, l) => s + l.amount, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardContent, {
    style: {
      padding: "var(--space-5) var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(MoneyRow, {
    amount: balance,
    locale: locale,
    note: "Worked out from " + data.ledger.length + " ledger entries · nothing is stored"
  }))), /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "Why this flips"
  }, "Card orders settle to Loqal and cash orders settle to you, so some weeks Loqal owes you and some weeks you owe Loqal. Delivery money never appears here."), /*#__PURE__*/React.createElement("div", {
    className: "lq-section-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "lq-section-title"
  }, "Ledger"), /*#__PURE__*/React.createElement("div", {
    className: "lq-section-sub"
  }, "Append-only. A correction is a new, reversing line."))), /*#__PURE__*/React.createElement(ResponsiveList, {
    columns: [{
      key: "what",
      label: "Entry"
    }, {
      key: "when",
      label: "Date",
      meta: true
    }, {
      key: "ref",
      label: "Reference",
      num: true
    }, {
      key: "amount",
      label: "Amount",
      num: true,
      render: (r, l) => /*#__PURE__*/React.createElement(MoneyRow, {
        amount: r.amount,
        variant: "inline",
        locale: l
      })
    }],
    rows: data.ledger,
    locale: locale
  }), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Settlement runs"), /*#__PURE__*/React.createElement(CardDescription, null, "Loqal marks each run sent or received by hand. Nothing moves on its own.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, [{
    id: "s1",
    period: "1–15 Aug",
    dir: "WE_PAY",
    status: "SENT",
    amount: 4820.5
  }, {
    id: "s2",
    period: "16–31 Jul",
    dir: "THEY_PAY",
    status: "RECEIVED",
    amount: -1290
  }].map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: {
      display: "grid",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 500
    }
  }, s.period), /*#__PURE__*/React.createElement(Badge, {
    variant: "outline"
  }, s.dir === "WE_PAY" ? "Loqal pays" : "You pay"), /*#__PURE__*/React.createElement(StatusPill, {
    enumName: "SettlementStatus",
    value: s.status,
    locale: locale,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      marginInlineStart: "auto"
    }
  }, /*#__PURE__*/React.createElement(MoneyRow, {
    amount: s.amount,
    variant: "inline",
    locale: locale
  }))), /*#__PURE__*/React.createElement(Separator, null)))))));
}
Object.assign(window, {
  MoneyScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/MoneyScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/OrderDetail.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Icon,
  StatusPill,
  Separator,
  Badge,
  Alert,
  MobileActionBar,
  DestructiveSheet,
  Sheet,
  Checkbox
} = window.LoqalDesignSystem_994dc4;
const TIMELINE = [{
  value: "PENDING_VERIFICATION",
  when: "14:20"
}, {
  value: "PENDING_PAYMENT",
  when: "14:20"
}, {
  value: "PENDING_BRAND",
  when: "14:21"
}];
function OrderDetail({
  order,
  lines,
  locale,
  onBack,
  onConfirm
}) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(CardTitle, {
    style: {
      fontFamily: "var(--font-mono)"
    }
  }, order.ref), /*#__PURE__*/React.createElement(CardDescription, null, order.when, " \xB7 ", order.pay, " \xB7 ", order.items, " ", order.items === 1 ? "item" : "items")), /*#__PURE__*/React.createElement(StatusPill, {
    enumName: "BrandOrderStatus",
    value: order.status,
    locale: locale
  }))), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10
    }
  }, lines.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.sku,
    style: {
      display: "flex",
      gap: 12,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-avatar lq-avatar--square lq-avatar--lg",
    style: {
      background: "var(--muted)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minInlineSize: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 500
    }
  }, l.name), /*#__PURE__*/React.createElement("div", {
    className: "lq-rl-meta"
  }, l.variant, /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, l.sku))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-sm)"
    }
  }, l.qty, " \xD7 ", l.price), /*#__PURE__*/React.createElement("div", {
    className: "lq-section-sub"
  }, "EGP")))), /*#__PURE__*/React.createElement(Separator, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Your items total"), /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xl)",
      fontWeight: 600
    }
  }, order.total, " EGP")), /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub"
  }, "No order total, no delivery fee, no other shop's lines. That is the whole order, and it is not yours to see.")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Shopper"), /*#__PURE__*/React.createElement(CardDescription, null, "For this delivery only. There is no customer list and no export.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Name"), /*#__PURE__*/React.createElement("span", null, order.shopper)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Phone"), /*#__PURE__*/React.createElement("span", {
    "data-num": true
  }, order.phone)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Address"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "end",
      maxInlineSize: "62%"
    }
  }, order.address))))), order.route === "RIDER_PER_BRAND" ? /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "The shopper books the rider"
  }, "Once you mark this parcel ready, Mariam is prompted to book a rider. You do not arrange delivery and no delivery fee reaches your balance.") : /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "You are delivering this one"
  }, "Add your own tracking note when the parcel leaves the shop."), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Status history")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, TIMELINE.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.value,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    enumName: "BrandOrderStatus",
    value: t.value,
    locale: locale,
    size: "sm"
  }), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub",
    "data-num": true,
    style: {
      marginInlineStart: "auto",
      fontFamily: "var(--font-mono)"
    }
  }, t.when))))), /*#__PURE__*/React.createElement(CardFooter, null, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    onClick: () => setCancelOpen(true),
    style: {
      color: "var(--destructive)"
    }
  }, "Cancel this order"))), /*#__PURE__*/React.createElement(MobileActionBar, {
    hint: "Stock stays reserved until you confirm.",
    secondary: /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "icon",
      "aria-label": "Chat"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "message-square",
      size: 18
    }))
  }, /*#__PURE__*/React.createElement(Button, {
    size: "tap",
    onClick: () => setConfirmOpen(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "package-check",
    size: 18
  }), "Confirm against shelf")), /*#__PURE__*/React.createElement(Sheet, {
    open: confirmOpen,
    title: "Confirm against the shelf",
    description: "Tick each line you have in your hand. Anything left unticked is treated as short.",
    onClose: () => setConfirmOpen(false),
    footer: /*#__PURE__*/React.createElement(Button, {
      size: "tap",
      onClick: () => {
        setConfirmOpen(false);
        onConfirm();
      }
    }, "Confirm 2 lines")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4,
      paddingBlockEnd: 12
    }
  }, lines.map(l => /*#__PURE__*/React.createElement(Checkbox, {
    key: l.sku,
    defaultChecked: true,
    label: l.qty + " × " + l.name + " — " + l.variant
  })))), /*#__PURE__*/React.createElement(DestructiveSheet, {
    open: cancelOpen,
    onClose: () => setCancelOpen(false),
    onConfirm: () => setCancelOpen(false),
    title: "Cancel order " + order.ref + "?",
    description: order.shopper + " is waiting on this order.",
    consequences: ["The " + order.items + (order.items === 1 ? " reserved item goes" : " reserved items go") + " back to available stock.", order.shopper + " is notified that you cancelled, with your shop name.", "Nothing is charged and no ledger entry is made.", "Cancelling counts against your reputation score."],
    confirmLabel: "Cancel the order",
    cancelLabel: "Keep the order"
  }));
}
Object.assign(window, {
  OrderDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/OrderDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/OrdersScreen.jsx
try { (() => {
const {
  Card,
  Button,
  Icon,
  StatusPill,
  ResponsiveList,
  Tabs,
  ListState,
  Badge
} = window.LoqalDesignSystem_994dc4;
const STATUS_TABS = [{
  value: "PENDING_BRAND",
  label: "Shelf check",
  count: 2
}, {
  value: "PACKED",
  label: "Packed",
  count: 1
}, {
  value: "HANDED_OVER",
  label: "With rider",
  count: 1
}, {
  value: "DELIVERED",
  label: "Delivered"
}, {
  value: "ALL",
  label: "All"
}];
function OrdersScreen({
  data,
  locale,
  onOpenOrder,
  state = "ready"
}) {
  const [tab, setTab] = React.useState("PENDING_BRAND");
  const rows = tab === "ALL" ? data.orders : data.orders.filter(o => o.status === tab);
  const columns = [{
    key: "ref",
    label: "Order",
    render: r => /*#__PURE__*/React.createElement("span", {
      "data-num": true,
      style: {
        fontFamily: "var(--font-mono)",
        fontWeight: 600
      }
    }, r.ref)
  }, {
    key: "when",
    label: "Placed",
    meta: true,
    render: r => r.when + " · " + r.items + (r.items === 1 ? " item" : " items")
  }, {
    key: "status",
    label: "Status",
    render: r => /*#__PURE__*/React.createElement(StatusPill, {
      enumName: "BrandOrderStatus",
      value: r.status,
      locale: locale
    })
  }, {
    key: "pay",
    label: "Payment"
  }, {
    key: "total",
    label: "Items total",
    num: true,
    render: r => r.total + " EGP"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onValueChange: setTab,
    tabs: STATUS_TABS
  }), state === "loading" ? /*#__PURE__*/React.createElement(ListState, {
    state: "loading",
    rows: 3
  }) : null, state === "error" ? /*#__PURE__*/React.createElement(ListState, {
    state: "error",
    title: "Could not load orders",
    body: "Check the connection and try again.",
    actionLabel: "Retry"
  }) : null, state === "ready" && rows.length === 0 ? /*#__PURE__*/React.createElement(ListState, {
    state: "empty",
    title: "Nothing in this status",
    body: "Orders move here as you work through them."
  }) : null, state === "ready" && rows.length ? /*#__PURE__*/React.createElement(ResponsiveList, {
    columns: columns,
    rows: rows,
    onRowClick: onOpenOrder,
    locale: locale
  }) : null, /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub",
    style: {
      textAlign: "center"
    }
  }, "You see your shop's items only. Loqal does not show you the wider order or other shops in it."));
}
Object.assign(window, {
  OrdersScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/OrdersScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/TodayScreen.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  StatusPill,
  MoneyRow,
  Alert,
  Badge,
  ResponsiveList,
  Separator
} = window.LoqalDesignSystem_994dc4;
function TodayScreen({
  data,
  locale,
  onOpenOrders,
  onOpenOrder
}) {
  const waiting = data.orders.filter(o => o.status === "PENDING_BRAND");
  const balance = data.ledger.reduce((s, l) => s + l.amount, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    enumName: "BrandOrderStatus",
    value: "PENDING_BRAND",
    locale: locale
  })), /*#__PURE__*/React.createElement(CardTitle, {
    style: {
      fontSize: "var(--text-xl)",
      marginBlockStart: 6
    }
  }, waiting.length, " orders waiting on a shelf check"), /*#__PURE__*/React.createElement(CardDescription, null, "Stock is held, not committed, until you confirm each one against the shelf.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, waiting.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.id,
    className: "lq-nav-item",
    style: {
      minBlockSize: 44
    },
    onClick: () => onOpenOrder(o)
  }, /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 600
    }
  }, o.ref), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, o.items, " ", o.items === 1 ? "item" : "items", " \xB7 ", o.when), /*#__PURE__*/React.createElement(Icon, {
    className: "lq-rl-chev",
    name: "chevron-right",
    size: 16,
    style: {
      marginInlineStart: "auto"
    }
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "lq-kpis"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Low stock"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "2"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "variants under 5")), /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Unread chat"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "2"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "oldest 22 min")), /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Delivered \xB7 30d"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "18"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "badge needs 20")), /*#__PURE__*/React.createElement(Card, {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Published"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, "41"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "1 draft"))), /*#__PURE__*/React.createElement(Alert, {
    variant: "wait",
    title: "A chat has gone 22 minutes without a reply"
  }, "At 30 minutes it escalates to your WhatsApp number, 010 2288 4471."), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Balance"), /*#__PURE__*/React.createElement(CardDescription, null, "Owner only. Updated after every settled order.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement(MoneyRow, {
    amount: balance,
    variant: "row",
    locale: locale
  }))));
}
Object.assign(window, {
  TodayScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/TodayScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/brand-console/data.js
try { (() => {
window.BRAND_DATA = {
  orders: [{
    id: "1042",
    ref: "#1042",
    when: "Today 14:20",
    items: 3,
    status: "PENDING_BRAND",
    total: "1,240.00",
    shopper: "Mariam Saeed",
    phone: "010 2288 4471",
    address: "14 Shar' Qasr El Aini, Apt 3, Sayeda Zeinab, Cairo",
    route: "RIDER_PER_BRAND",
    pay: "COD"
  }, {
    id: "1041",
    ref: "#1041",
    when: "Today 11:02",
    items: 1,
    status: "PENDING_BRAND",
    total: "385.50",
    shopper: "Youssef Adel",
    phone: "011 7745 0022",
    address: "9 Shar' El Gomhoreya, Shubra, Cairo",
    route: "BRAND_OWN_DELIVERY",
    pay: "Card"
  }, {
    id: "1040",
    ref: "#1040",
    when: "Today 09:41",
    items: 2,
    status: "PACKED",
    total: "640.00",
    shopper: "Nour Hassan",
    phone: "012 3390 1187",
    address: "Villa 6, Zahraa El Maadi, Cairo",
    route: "RIDER_PER_BRAND",
    pay: "Card"
  }, {
    id: "1039",
    ref: "#1039",
    when: "Yesterday 18:55",
    items: 2,
    status: "HANDED_OVER",
    total: "99.99",
    shopper: "Aya Kamal",
    phone: "010 5512 6690",
    address: "22 Shar' Sudan, Mohandessin, Giza",
    route: "RIDER_PER_BRAND",
    pay: "COD"
  }, {
    id: "1036",
    ref: "#1036",
    when: "12 Aug",
    items: 4,
    status: "DELIVERED",
    total: "2,105.00",
    shopper: "Salma Ezz",
    phone: "012 8890 3312",
    address: "3 Shar' El Nil, Dokki, Giza",
    route: "RIDER_PER_BRAND",
    pay: "Card"
  }, {
    id: "1031",
    ref: "#1031",
    when: "9 Aug",
    items: 1,
    status: "DELIVERY_FAILED",
    total: "310.00",
    shopper: "Hazem Roushdy",
    phone: "011 2244 8890",
    address: "7 Shar' Ahmed Orabi, Imbaba, Giza",
    route: "RIDER_PER_BRAND",
    pay: "COD"
  }],
  lines: [{
    sku: "NFL-BAG-018",
    name: "Crossbody bag — tan",
    variant: "Tan / medium",
    qty: 1,
    price: "940.00"
  }, {
    sku: "NFL-WLT-221",
    name: "Card wallet",
    variant: "Dark brown",
    qty: 2,
    price: "150.00"
  }],
  products: [{
    id: "p1",
    name: "Crossbody bag",
    ar: "شنطة كروس",
    status: "PUBLISHED",
    price: "940.00",
    available: 14,
    reserved: 3,
    variants: 3
  }, {
    id: "p2",
    name: "Card wallet",
    ar: "محفظة كروت",
    status: "PUBLISHED",
    price: "150.00",
    available: 109,
    reserved: 11,
    variants: 2
  }, {
    id: "p3",
    name: "Belt — plain",
    ar: "حزام سادة",
    status: "PUBLISHED",
    price: "385.50",
    available: 2,
    reserved: 0,
    variants: 4
  }, {
    id: "p4",
    name: "Laptop sleeve",
    ar: "جراب لابتوب",
    status: "DRAFT",
    price: "—",
    available: 0,
    reserved: 0,
    variants: 0
  }, {
    id: "p5",
    name: "Keyring",
    ar: "ميدالية",
    status: "ARCHIVED",
    price: "45.00",
    available: 0,
    reserved: 0,
    variants: 1
  }],
  drops: [{
    id: "d1",
    name: "",
    price: "",
    done: false
  }, {
    id: "d2",
    name: "Card wallet — black",
    price: "150.00",
    done: true
  }, {
    id: "d3",
    name: "Belt — braided",
    price: "",
    done: false
  }, {
    id: "d4",
    name: "",
    price: "",
    done: false
  }, {
    id: "d5",
    name: "Tote — canvas",
    price: "620.00",
    done: true
  }, {
    id: "d6",
    name: "",
    price: "",
    done: false
  }],
  threads: [{
    id: "t1",
    who: "Mariam Saeed",
    last: "هو في نفس الشنطة لون أسود؟",
    when: "14:31",
    unread: 2,
    minutes: 22
  }, {
    id: "t2",
    who: "Youssef Adel",
    last: "Thanks, I'll wait for the rider.",
    when: "11:40",
    unread: 0,
    minutes: 0
  }, {
    id: "t3",
    who: "Nour Hassan",
    last: "Can you gift wrap it?",
    when: "Yesterday",
    unread: 0,
    minutes: 0
  }],
  messages: [{
    from: "them",
    text: "مساء الخير، الشنطة التان متوفرة؟",
    when: "14:22"
  }, {
    from: "us",
    text: "أيوه متوفرة، عندنا ٣ قطع.",
    when: "14:26"
  }, {
    from: "them",
    text: "هو في نفس الشنطة لون أسود؟",
    when: "14:31"
  }],
  ledger: [{
    id: "l1",
    when: "15 Aug",
    what: "Order #1036 — commission 12%",
    ref: "#1036",
    amount: -252.60
  }, {
    id: "l2",
    when: "15 Aug",
    what: "Order #1036 — card settlement",
    ref: "#1036",
    amount: 2105.00
  }, {
    id: "l3",
    when: "14 Aug",
    what: "Monthly fee — August",
    ref: "FEE-08",
    amount: -350.00
  }, {
    id: "l4",
    when: "12 Aug",
    what: "Order #1029 — cash collected by brand",
    ref: "#1029",
    amount: -880.00
  }, {
    id: "l5",
    when: "11 Aug",
    what: "Reversal of #1027 commission",
    ref: "#1027",
    amount: 98.10
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/brand-console/data.js", error: String((e && e.message) || e) }); }

// ui_kits/sales-console/RegisterShop.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  Input,
  Label,
  Select,
  Textarea,
  FieldHint,
  Alert,
  MobileActionBar,
  Tabs,
  Checkbox
} = window.LoqalDesignSystem_994dc4;

/* S2 — register a brand in the room. Two-language name because Product.name and
   Brand.description are { ar, en }, and the owner will type Arabic. */
function RegisterShop({
  locale,
  onNext
}) {
  const [tab, setTab] = React.useState("ar");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "The shop"), /*#__PURE__*/React.createElement(CardDescription, null, "Both languages. The Arabic name is what shoppers see first.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    value: tab,
    onValueChange: setTab,
    tabs: [{
      value: "ar",
      label: "العربية"
    }, {
      value: "en",
      label: "English"
    }]
  }), tab === "ar" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "na"
  }, "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u062C\u0631"), /*#__PURE__*/React.createElement(Input, {
    id: "na",
    dir: "rtl",
    lang: "ar",
    placeholder: "\u0646\u0641\u0631\u062A\u0627\u0631\u064A \u0644\u0644\u062C\u0644\u0648\u062F"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "da",
    optional: true
  }, "\u0648\u0635\u0641 \u0642\u0635\u064A\u0631"), /*#__PURE__*/React.createElement(Textarea, {
    id: "da",
    dir: "rtl",
    lang: "ar",
    rows: 2,
    placeholder: "\u0634\u0646\u0637 \u0648\u0623\u062D\u0632\u0645\u0629 \u062C\u0644\u062F \u0637\u0628\u064A\u0639\u064A"
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "ne"
  }, "Shop name"), /*#__PURE__*/React.createElement(Input, {
    id: "ne",
    placeholder: "Nefertari Leather"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "de",
    optional: true
  }, "Short description"), /*#__PURE__*/React.createElement(Textarea, {
    id: "de",
    rows: 2,
    placeholder: "Hand-cut leather bags and belts"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "cat"
  }, "Category"), /*#__PURE__*/React.createElement(Select, {
    id: "cat",
    placeholder: "Choose one",
    options: [{
      value: "bags",
      label: "Bags & leather"
    }, {
      value: "home",
      label: "Home"
    }, {
      value: "clothing",
      label: "Clothing"
    }]
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "area"
  }, "Area"), /*#__PURE__*/React.createElement(Input, {
    id: "area",
    placeholder: "Sayeda Zeinab, Cairo"
  }))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "The owner"), /*#__PURE__*/React.createElement(CardDescription, null, "They get an invite by SMS and set their own password.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "own"
  }, "Owner name"), /*#__PURE__*/React.createElement(Input, {
    id: "own",
    placeholder: "Full name"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "ph"
  }, "Phone"), /*#__PURE__*/React.createElement(Input, {
    id: "ph",
    inputMode: "tel",
    placeholder: "010 0000 0000"
  }), /*#__PURE__*/React.createElement(FieldHint, null, "Also the WhatsApp number unanswered chats escalate to.")), /*#__PURE__*/React.createElement(Checkbox, {
    label: "They have a national ID with them now"
  })))), /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "You are not creating a login yet"
  }, "The shop is created as an application. It goes live once an admin approves it and sets the commercial terms."), /*#__PURE__*/React.createElement(MobileActionBar, {
    hint: "Next: the free months and commission you can offer."
  }, /*#__PURE__*/React.createElement(Button, {
    size: "tap",
    onClick: onNext
  }, "Continue to terms")));
}
Object.assign(window, {
  RegisterShop
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sales-console/RegisterShop.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sales-console/SalesApp.jsx
try { (() => {
const {
  AppShell,
  Button,
  Icon,
  ListState
} = window.LoqalDesignSystem_994dc4;
const GROUPS = [{
  items: [{
    id: "pack",
    label: "Sales pack",
    icon: "chart-no-axes-column"
  }, {
    id: "register",
    label: "Register a shop",
    icon: "store"
  }, {
    id: "terms",
    label: "Terms",
    icon: "file-pen"
  }]
}];
const TABS = [{
  id: "pack",
  label: "Pack",
  icon: "chart-no-axes-column"
}, {
  id: "register",
  label: "Register",
  icon: "store"
}, {
  id: "terms",
  label: "Terms",
  icon: "file-pen"
}];
const TITLES = {
  pack: "Sales pack",
  register: "Register a shop",
  terms: "Terms"
};
function SalesApp({
  preferences,
  locale
}) {
  const data = window.SALES_DATA;
  const [screen, setScreen] = React.useState("pack");
  return /*#__PURE__*/React.createElement(AppShell, {
    console: "Sales",
    title: TITLES[screen],
    groups: GROUPS,
    tabs: TABS,
    active: screen,
    onNavigate: setScreen,
    preferences: preferences
  }, screen === "pack" ? /*#__PURE__*/React.createElement(window.SalesPack, {
    data: data,
    locale: locale,
    onRegister: () => setScreen("register")
  }) : null, screen === "register" ? /*#__PURE__*/React.createElement(window.RegisterShop, {
    locale: locale,
    onNext: () => setScreen("terms")
  }) : null, screen === "terms" ? /*#__PURE__*/React.createElement(window.SetTerms, {
    data: data,
    locale: locale,
    onDone: () => setScreen("pack")
  }) : null);
}
Object.assign(window, {
  SalesApp
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sales-console/SalesApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sales-console/SalesPack.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  Select,
  Label,
  Badge,
  Alert,
  Progress,
  ListState,
  Separator,
  MobileActionBar,
  Tabs
} = window.LoqalDesignSystem_994dc4;

/* S1 — the pitch, standing in the shop. Everything here is market demand and
   nothing here is a customer. Below the k-anonymity floor of 3 brands the
   category comparison is blocked outright rather than rounded. */
function SalesPack({
  data,
  locale,
  onRegister
}) {
  const [thin, setThin] = React.useState(false);
  const p = thin ? {
    ...data.pack,
    ...data.thin
  } : data.pack;
  const blocked = p.brandsInCategory < 3;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "cat"
  }, "Category and area"), /*#__PURE__*/React.createElement(Select, {
    id: "cat",
    value: thin ? "thin" : "full",
    onValueChange: v => setThin(v === "thin"),
    options: [{
      value: "full",
      label: "Bags & leather · Sayeda Zeinab"
    }, {
      value: "thin",
      label: "Ceramics · Fustat"
    }]
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "What shoppers are looking for here"), /*#__PURE__*/React.createElement(CardDescription, null, "Last 30 days, ", p.area, ".")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    className: "lq-kpis",
    style: {
      gridTemplateColumns: "repeat(2,minmax(0,1fr))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Searches"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, p.searches), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "for ", p.category)), /*#__PURE__*/React.createElement("div", {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Product views"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, p.views), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "in this area")), /*#__PURE__*/React.createElement("div", {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Shoppers"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, p.shoppers), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "who bought once")), /*#__PURE__*/React.createElement("div", {
    className: "lq-kpi"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-key"
  }, "Unmet demand"), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-val"
  }, p.unmet), /*#__PURE__*/React.createElement("span", {
    className: "lq-kpi-note"
  }, "searches with no result"))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "How shops like yours do"), /*#__PURE__*/React.createElement(CardDescription, null, "Averaged across ", p.brandsInCategory, " shops in ", p.category, ". No shop is named.")), /*#__PURE__*/React.createElement(CardContent, null, blocked ? /*#__PURE__*/React.createElement(ListState, {
    state: "denied",
    title: "Not enough shops to show an average",
    body: "Only " + p.brandsInCategory + " shops sell " + p.category + " here. An average of two shops is one competitor's private revenue, so Loqal will not show it.",
    requiredRole: "3 SHOPS MINIMUM"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Average order"), /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xl)",
      fontWeight: 600
    }
  }, p.avgOrder, " EGP")), /*#__PURE__*/React.createElement(Separator, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-rl-key"
  }, "Average monthly sales"), /*#__PURE__*/React.createElement("span", {
    "data-num": true,
    style: {
      fontFamily: "var(--font-mono)",
      fontSize: "var(--text-xl)",
      fontWeight: 600
    }
  }, p.avgMonthly, " EGP")), /*#__PURE__*/React.createElement("p", {
    className: "lq-section-sub"
  }, "Averages only, never a named shop and never a single shop's figures.")))), /*#__PURE__*/React.createElement(MobileActionBar, {
    hint: "Signs the shop up here, in the room."
  }, /*#__PURE__*/React.createElement(Button, {
    size: "tap",
    onClick: onRegister
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "store",
    size: 18
  }), "Register this shop")));
}
Object.assign(window, {
  SalesPack
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sales-console/SalesPack.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sales-console/SetTerms.jsx
try { (() => {
const {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Icon,
  Input,
  Label,
  Select,
  FieldHint,
  Alert,
  MobileActionBar,
  Separator,
  Badge,
  Progress
} = window.LoqalDesignSystem_994dc4;

/* S3 — terms inside a band. The rep can move within bounds the platform sets and
   cannot go past them; the bound is shown as a fact, not as a validation error
   discovered after typing. */
function SetTerms({
  data,
  locale,
  onDone
}) {
  const b = data.bounds;
  const [months, setMonths] = React.useState(b.defaultFreeMonths);
  const [bps, setBps] = React.useState(1200);
  const monthsOver = months > b.maxFreeMonths;
  const bpsUnder = bps < b.commissionFloorBps;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Free months"), /*#__PURE__*/React.createElement(CardDescription, null, b.defaultFreeMonths, " is standard. You can go to ", b.maxFreeMonths, ", no further.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, [1, 2, 3, 4, 5, 6].map(m => /*#__PURE__*/React.createElement(Button, {
    key: m,
    variant: months === m ? "default" : "outline",
    onClick: () => setMonths(m),
    style: {
      flex: 1,
      minInlineSize: 0
    }
  }, m))), /*#__PURE__*/React.createElement(FieldHint, {
    invalid: monthsOver
  }, monthsOver ? "Above the " + b.maxFreeMonths + "-month ceiling. An admin has to approve this." : "Within your band.")))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "Commission"), /*#__PURE__*/React.createElement(CardDescription, null, "Floor is ", (b.commissionFloorBps / 100).toFixed(2), "%. The rate that applies is the one in force when an order is placed.")), /*#__PURE__*/React.createElement(CardContent, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, {
    htmlFor: "bps"
  }, "Per-order commission"), /*#__PURE__*/React.createElement(Input, {
    id: "bps",
    inputMode: "decimal",
    unit: "%",
    value: (bps / 100).toFixed(2),
    onChange: e => setBps(Math.round(parseFloat(e.target.value || "0") * 100)),
    invalid: bpsUnder
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Progress, {
    value: Math.min(100, bps / 2000 * 100),
    marks: [b.commissionFloorBps / 2000 * 100],
    tone: bpsUnder ? "bad" : "default"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginBlockStart: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, "floor ", (b.commissionFloorBps / 100).toFixed(0), "%"), /*#__PURE__*/React.createElement("span", {
    className: "lq-section-sub"
  }, "20%"))), /*#__PURE__*/React.createElement(FieldHint, {
    invalid: bpsUnder
  }, bpsUnder ? "Below the floor. This cannot be submitted." : "Above the floor.")))), /*#__PURE__*/React.createElement(Alert, {
    variant: "info",
    title: "What the shop will see"
  }, "The owner sees these terms on their settings screen and cannot change them. Only an admin can."), /*#__PURE__*/React.createElement(MobileActionBar, {
    hint: monthsOver || bpsUnder ? "Fix the two figures above first." : "Sends the application to the admin queue."
  }, /*#__PURE__*/React.createElement(Button, {
    size: "tap",
    disabled: monthsOver || bpsUnder,
    onClick: onDone
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 18
  }), "Submit the application")));
}
Object.assign(window, {
  SetTerms
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sales-console/SetTerms.jsx", error: String((e && e.message) || e) }); }

// ui_kits/sales-console/data.js
try { (() => {
window.SALES_DATA = {
  pack: {
    category: "Bags & leather",
    area: "Sayeda Zeinab",
    searches: "2,140",
    views: "18,900",
    shoppers: "1,320",
    brandsInCategory: 7,
    avgOrder: "612.00",
    avgMonthly: "18,400.00",
    unmet: "31%"
  },
  thin: {
    category: "Ceramics",
    area: "Fustat",
    brandsInCategory: 2
  },
  bounds: {
    defaultFreeMonths: 3,
    maxFreeMonths: 6,
    commissionFloorBps: 800
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/sales-console/data.js", error: String((e && e.message) || e) }); }

__ds_ns.MoneyRow = __ds_scope.MoneyRow;

__ds_ns.ResponsiveList = __ds_scope.ResponsiveList;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.STATUS_MAP = __ds_scope.STATUS_MAP;

__ds_ns.ENUM_NAMES = __ds_scope.ENUM_NAMES;

__ds_ns.ListState = __ds_scope.ListState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.DestructiveSheet = __ds_scope.DestructiveSheet;

__ds_ns.MobileActionBar = __ds_scope.MobileActionBar;

__ds_ns.Sheet = __ds_scope.Sheet;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.FieldHint = __ds_scope.FieldHint;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Separator = __ds_scope.Separator;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.AppShell = __ds_scope.AppShell;

})();
