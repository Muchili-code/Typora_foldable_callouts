class calloutsPlugin extends BaseCustomPlugin {
    styleTemplate = () => {
        const { list, set_title_color } = this.config;
        
        // 1. 基础样式定义
        const callouts = list.map(c => (
            `.plugin-callout[callout-type="${c.type}"] {
                --callout-bg-color: ${c.background_color};
                --callout-left-line-color: ${c.left_line_color};
                --callout-icon: "${c.icon}";
            }`
        )).join("\n");

        // 2. 核心交互与修复后的布局样式
        const hover = `
            /* 基础容器 */
            .plugin-callout { 
                overflow: hidden !important; 
                transition: border 0.3s; 
            }
            
            /* --- 标题行交互区域 --- */
            .plugin-callout.callout-foldable > p:first-child { 
                cursor: pointer !important; 
                position: relative !important; 
                
                /* Flex 布局修复对齐问题 */
                display: flex !important;
                align-items: center !important; 
                gap: 8px !important; /* 图标与标题的间距 */
                
                min-height: 2em;
                padding-right: 30px !important; /* 右侧留给箭头的空间 */
                transition: background 0.2s !important;
            }

            /* 悬停效果：白色半透明叠加 */
            .plugin-callout.callout-foldable > p:first-child:hover { 
                background-color: rgba(255, 255, 255, 0.3) !important; 
            }

            /* --- 标题文字处理 (核心修复点) --- */
            /* 非编辑状态下：将源码文字变透明，作为占位符 */
            .plugin-callout.callout-foldable > p:first-child:not(.md-focus) span.md-plain {
                color: transparent !important;
                position: relative !important;
                line-height: normal !important;
            }
            
            /* 使用伪元素显示清洗后的标题 */
            .plugin-callout.callout-foldable > p:first-child:not(.md-focus) span.md-plain::after {
                content: attr(data-title);
                visibility: visible !important;
                position: absolute !important;
                left: 0 !important;
                
                /* 修复错位与换行问题的关键代码 */
                top: 50% !important;
                transform: translateY(-50%) !important;
                white-space: nowrap !important;
                
                color: var(--callout-left-line-color) !important;
                font-weight: bold !important;
            }

            /* --- 折叠/展开箭头 --- */
            .plugin-callout.callout-foldable > p:first-child::after {
                content: "▾" !important;
                position: absolute !important;
                right: 12px !important;
                /* 箭头也需要绝对垂直居中 */
                top: 50% !important;
                transform: translateY(-50%) !important;
                
                color: var(--callout-left-line-color) !important;
                font-family: serif !important;
                transition: transform 0.3s !important;
            }
            /* 折叠态旋转箭头 */
            .plugin-callout.callout-foldable.callout-folded > p:first-child::after {
                transform: translateY(-50%) rotate(-90deg) !important;
            }

            /* --- 颜色与图标修正 --- */
            /* 强制图标颜色 */
            .plugin-callout > p:first-child::before { 
                color: var(--callout-left-line-color) !important; 
                /* 确保图标本身垂直居中 */
                align-self: center !important;
                margin-top: 0 !important; 
            }
            /* 强制文字颜色 */
            .plugin-callout > p:first-child span:first-child { 
                color: var(--callout-left-line-color) !important; 
            }

            /* --- 平滑过渡动画 --- */
            .plugin-callout.callout-foldable > :not(:first-child) {
                transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s !important;
                max-height: 5000px;
                opacity: 1;
                overflow: hidden !important;
            }
            .plugin-callout.callout-foldable.callout-folded > :not(:first-child) {
                max-height: 0 !important;
                opacity: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
            }
        `;

        const colorCss = `.plugin-callout > p:first-child::before { color: var(--callout-left-line-color); }`;
        const color = set_title_color ? colorCss : "";

        return { callouts, hover, color };
    }

    process = () => {
        const { eventHub, exportHelper } = this.utils;
        eventHub.addEventListener(eventHub.eventType.firstFileInit, this.range);
        eventHub.addEventListener(eventHub.eventType.fileEdited, this.range);
        exportHelper.register("callouts", this.beforeExport, this.afterExport);

        // 点击事件委托
        document.getElementById("write").addEventListener("click", ev => {
            const header = ev.target.closest(".plugin-callout.callout-foldable > p:first-child");
            if (header) {
                const blockquote = header.parentElement;
                blockquote.classList.toggle("callout-folded");
                ev.preventDefault();
                ev.stopPropagation();
            }
        }, true);
    }

    range = () => {
        const pList = this.utils.entities.querySelectorAllInWrite("blockquote > p:first-child");
        pList.forEach(p => {
            const blockquote = p.parentElement;
            // 正则：精准提取 Type, Fold标识, 和可选的 Title
            const result = p.textContent.match(/^\[!(?<type>\w+)\](?<fold>[+-]?)\s*(?:"(?<title>.*?)")?/);
            const ok = result && result.groups;

            blockquote.classList.toggle("plugin-callout", ok);
            if (ok) {
                const { type, fold, title } = result.groups;
                // 如果没有 title 组（即没有双引号内容），使用 Type 大写作为默认标题
                const displayTitle = title || type.toUpperCase();
                
                const firstSpan = p.querySelector('span:first-child');
                if (firstSpan) {
                    firstSpan.setAttribute('data-type', type);
                    firstSpan.setAttribute('data-title', displayTitle);
                }
                blockquote.setAttribute("callout-type", type.toLowerCase());

                // 仅当存在 + 或 - 时启用折叠功能
                const isFoldable = fold === "+" || fold === "-";
                blockquote.classList.toggle("callout-foldable", isFoldable);

                if (isFoldable) {
                    // 初始化折叠状态
                    if (!blockquote.hasAttribute("callout-init")) {
                        blockquote.classList.add("callout-folded");
                        blockquote.setAttribute("callout-init", "true");
                    }
                } else {
                    blockquote.classList.remove("callout-folded", "callout-foldable");
                }
            }
        });
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.template)
    check = args => !args[0]?.type === "html-plain" && this.utils.entities.querySelectorInWrite(".plugin-callout")
    beforeExport = (...args) => this.check(args) ? this.utils.styleTemplater.getStyleContent(this.fixedName).replace(/--callout-icon: ".*?";/g, "") : null
    afterExport = (html, ...args) => {
        if (!this.check(args)) return;
        const quotesInPage = [...this.utils.entities.querySelectorAllInWrite("blockquote")];
        const doc = new DOMParser().parseFromString(html, "text/html");
        const quotesInHTML = [...doc.querySelectorAll("blockquote")];
        this.utils.zip(quotesInPage, quotesInHTML).forEach(([p, h]) => {
            if (p.classList.contains("plugin-callout")) {
                h.className = p.className;
                h.setAttribute("callout-type", p.getAttribute("callout-type"));
            }
        });
        return `<!DOCTYPE HTML>\n${doc.documentElement.outerHTML}`;
    }
}

module.exports = { plugin: calloutsPlugin };