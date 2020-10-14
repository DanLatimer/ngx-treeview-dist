import { Component, Input, Output, EventEmitter } from '@angular/core';
import { isNil, includes } from 'lodash';
import { TreeviewI18n } from '../../models/treeview-i18n';
import { TreeviewItem } from '../../models/treeview-item';
import { TreeviewConfig } from '../../models/treeview-config';
import { TreeviewHelper } from '../../helpers/treeview-helper';
import { TreeviewEventParser } from '../../helpers/treeview-event-parser';
class FilterTreeviewItem extends TreeviewItem {
    constructor(item) {
        super({
            text: item.text,
            value: item.value,
            disabled: item.disabled,
            checked: item.checked,
            collapsed: item.collapsed,
            children: item.children
        });
        this.refItem = item;
    }
    updateRefChecked() {
        this.children.forEach(child => {
            if (child instanceof FilterTreeviewItem) {
                child.updateRefChecked();
            }
        });
        let refChecked = this.checked;
        if (refChecked) {
            for (const refChild of this.refItem.children) {
                if (!refChild.checked) {
                    refChecked = false;
                    break;
                }
            }
        }
        this.refItem.checked = refChecked;
    }
}
export class TreeviewComponent {
    constructor(i18n, defaultConfig, eventParser) {
        this.i18n = i18n;
        this.defaultConfig = defaultConfig;
        this.eventParser = eventParser;
        this.selectedChange = new EventEmitter();
        this.filterChange = new EventEmitter();
        this.filterText = '';
        this.config = this.defaultConfig;
        this.allItem = new TreeviewItem({ text: 'All', value: undefined });
    }
    get hasFilterItems() {
        return !isNil(this.filterItems) && this.filterItems.length > 0;
    }
    get maxHeight() {
        return `${this.config.maxHeight}`;
    }
    ngOnInit() {
        this.createHeaderTemplateContext();
        this.generateSelection();
    }
    ngOnChanges(changes) {
        const itemsSimpleChange = changes.items;
        if (!isNil(itemsSimpleChange) && !isNil(this.items)) {
            this.updateFilterItems();
            this.updateCollapsedOfAll();
            this.raiseSelectedChange();
        }
    }
    onAllCollapseExpand() {
        this.allItem.collapsed = !this.allItem.collapsed;
        this.filterItems.forEach(item => item.setCollapsedRecursive(this.allItem.collapsed));
    }
    onFilterTextChange(text) {
        this.filterText = text;
        this.filterChange.emit(text);
        this.updateFilterItems();
    }
    /**
     * IE has an issue where it does not send a change event for when an indeterminate checkbox changes to become determinate.
     * To work around this we explicity set it checked if it's indeterminate and we use the onClick event instead of onChange.
     */
    onAllCheckedChange() {
        this.standardizeEventOrder(() => {
            if (this.allItem.indeterminate) {
                this.allItem.checked = true;
            }
            const checked = this.allItem.checked;
            this.filterItems.forEach(item => {
                item.setCheckedRecursive(checked);
                if (item instanceof FilterTreeviewItem) {
                    item.updateRefChecked();
                }
            });
            this.raiseSelectedChange();
        });
    }
    /**
     * IE performs the onClick event before the onChange event while Chrome and perform it in the other order.
     * By pushing the callback onto the event queue it will always be executed immediately after all pending events
     */
    standardizeEventOrder(callback) {
        setTimeout(callback, 0);
    }
    onItemCheckedChange(item, checked) {
        if (item instanceof FilterTreeviewItem) {
            item.updateRefChecked();
        }
        this.updateCheckedOfAll();
        this.raiseSelectedChange();
    }
    raiseSelectedChange() {
        this.generateSelection();
        const values = this.eventParser.getSelectedChange(this);
        setTimeout(() => {
            this.selectedChange.emit(values);
        });
    }
    createHeaderTemplateContext() {
        this.headerTemplateContext = {
            config: this.config,
            item: this.allItem,
            onCheckedChange: () => this.onAllCheckedChange(),
            onCollapseExpand: () => this.onAllCollapseExpand(),
            onFilterTextChange: (text) => this.onFilterTextChange(text)
        };
    }
    generateSelection() {
        let checkedItems = [];
        let uncheckedItems = [];
        if (!isNil(this.items)) {
            const selection = TreeviewHelper.concatSelection(this.items, checkedItems, uncheckedItems);
            checkedItems = selection.checked;
            uncheckedItems = selection.unchecked;
        }
        this.selection = {
            checkedItems,
            uncheckedItems
        };
    }
    updateFilterItems() {
        if (this.filterText !== '') {
            const filterItems = [];
            const filterText = this.filterText.toLowerCase();
            this.items.forEach(item => {
                const newItem = this.filterItem(item, filterText);
                if (!isNil(newItem)) {
                    filterItems.push(newItem);
                }
            });
            this.filterItems = filterItems;
        }
        else {
            this.filterItems = this.items;
        }
        this.updateCheckedOfAll();
    }
    filterItem(item, filterText) {
        const isMatch = includes(item.text.toLowerCase(), filterText);
        if (isMatch) {
            return item;
        }
        else {
            if (!isNil(item.children)) {
                const children = [];
                item.children.forEach(child => {
                    const newChild = this.filterItem(child, filterText);
                    if (!isNil(newChild)) {
                        children.push(newChild);
                    }
                });
                if (children.length > 0) {
                    const newItem = new FilterTreeviewItem(item);
                    newItem.collapsed = false;
                    newItem.children = children;
                    return newItem;
                }
            }
        }
        return undefined;
    }
    updateCheckedOfAll() {
        let itemChecked = null;
        for (const filterItem of this.filterItems) {
            if (itemChecked === null) {
                itemChecked = filterItem.checked;
            }
            else if (itemChecked !== filterItem.checked) {
                itemChecked = undefined;
                break;
            }
        }
        if (itemChecked === null) {
            itemChecked = false;
        }
        this.allItem.checked = itemChecked;
    }
    updateCollapsedOfAll() {
        let hasItemExpanded = false;
        for (const filterItem of this.filterItems) {
            if (!filterItem.collapsed) {
                hasItemExpanded = true;
                break;
            }
        }
        this.allItem.collapsed = !hasItemExpanded;
    }
}
TreeviewComponent.decorators = [
    { type: Component, args: [{
                selector: 'ngx-treeview',
                template: "<ng-template #defaultItemTemplate let-item=\"item\" let-onCollapseExpand=\"onCollapseExpand\"\r\n  let-onCheckedChange=\"onCheckedChange\">\r\n  <div class=\"form-inline row-item\">\r\n    <i *ngIf=\"item.children\" (click)=\"onCollapseExpand()\" aria-hidden=\"true\" [ngSwitch]=\"item.collapsed\">\r\n      <svg *ngSwitchCase=\"true\" width=\"0.8rem\" height=\"0.8rem\" viewBox=\"0 0 16 16\" class=\"bi bi-caret-right-fill\"\r\n        fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\">\r\n        <path\r\n          d=\"M12.14 8.753l-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z\" />\r\n      </svg>\r\n      <svg *ngSwitchCase=\"false\" width=\"0.8rem\" height=\"0.8rem\" viewBox=\"0 0 16 16\" class=\"bi bi-caret-down-fill\"\r\n        fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\">\r\n        <path\r\n          d=\"M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z\" />\r\n      </svg>\r\n    </i>\r\n    <div class=\"form-check\">\r\n      <input type=\"checkbox\" class=\"form-check-input\" [(ngModel)]=\"item.checked\" (ngModelChange)=\"onCheckedChange()\"\r\n        [disabled]=\"item.disabled\" [indeterminate]=\"item.indeterminate\" />\r\n      <label class=\"form-check-label\" (click)=\"item.checked = !item.checked; onCheckedChange()\">\r\n        {{item.text}}\r\n      </label>\r\n    </div>\r\n  </div>\r\n</ng-template>\r\n<ng-template #defaultHeaderTemplate let-config=\"config\" let-item=\"item\" let-onCollapseExpand=\"onCollapseExpand\"\r\n  let-onCheckedChange=\"onCheckedChange\" let-onFilterTextChange=\"onFilterTextChange\">\r\n  <div *ngIf=\"config.hasFilter\" class=\"row row-filter\">\r\n    <div class=\"col-12\">\r\n      <input class=\"form-control\" type=\"text\" [placeholder]=\"i18n.getFilterPlaceholder()\" [(ngModel)]=\"filterText\"\r\n        (ngModelChange)=\"onFilterTextChange($event)\" />\r\n    </div>\r\n  </div>\r\n  <div *ngIf=\"hasFilterItems\">\r\n    <div *ngIf=\"config.hasAllCheckBox || config.hasCollapseExpand\" class=\"row row-all\">\r\n      <div class=\"col-12\">\r\n        <div class=\"form-check form-check-inline\" *ngIf=\"config.hasAllCheckBox\">\r\n          <input type=\"checkbox\" class=\"form-check-input\" [(ngModel)]=\"item.checked\" (click)=\"onCheckedChange()\"\r\n            [indeterminate]=\"item.indeterminate\" />\r\n          <label class=\"form-check-label\" (click)=\"item.checked = !item.checked; onCheckedChange()\">\r\n            {{i18n.getAllCheckboxText()}}\r\n          </label>\r\n        </div>\r\n        <label *ngIf=\"config.hasCollapseExpand\" class=\"float-right form-check-label\" (click)=\"onCollapseExpand()\">\r\n          <i [title]=\"i18n.getTooltipCollapseExpandText(item.collapsed)\" aria-hidden=\"true\" [ngSwitch]=\"item.collapsed\">\r\n            <svg *ngSwitchCase=\"true\" width=\"1em\" height=\"1em\" viewBox=\"0 0 16 16\" class=\"bi bi-arrows-angle-expand\"\r\n              fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\">\r\n              <path fill-rule=\"evenodd\"\r\n                d=\"M1.5 10.036a.5.5 0 0 1 .5.5v3.5h3.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5z\" />\r\n              <path fill-rule=\"evenodd\"\r\n                d=\"M6.354 9.646a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 0 1-.708-.708l4.5-4.5a.5.5 0 0 1 .708 0zm8.5-8.5a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 0 1-.708-.708l4.5-4.5a.5.5 0 0 1 .708 0z\" />\r\n              <path fill-rule=\"evenodd\"\r\n                d=\"M10.036 1.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 1 1-1 0V2h-3.5a.5.5 0 0 1-.5-.5z\" />\r\n            </svg>\r\n            <svg *ngSwitchCase=\"false\" width=\"1em\" height=\"1em\" viewBox=\"0 0 16 16\" class=\"bi bi-arrows-angle-contract\"\r\n              fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\">\r\n              <path fill-rule=\"evenodd\"\r\n                d=\"M9.5 2.036a.5.5 0 0 1 .5.5v3.5h3.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5z\" />\r\n              <path fill-rule=\"evenodd\"\r\n                d=\"M14.354 1.646a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 1 1-.708-.708l4.5-4.5a.5.5 0 0 1 .708 0zm-7.5 7.5a.5.5 0 0 1 0 .708l-4.5 4.5a.5.5 0 0 1-.708-.708l4.5-4.5a.5.5 0 0 1 .708 0z\" />\r\n              <path fill-rule=\"evenodd\"\r\n                d=\"M2.036 9.5a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V10h-3.5a.5.5 0 0 1-.5-.5z\" />\r\n            </svg>\r\n          </i>\r\n        </label>\r\n      </div>\r\n    </div>\r\n    <div *ngIf=\"config.hasDivider\" class=\"dropdown-divider\"></div>\r\n  </div>\r\n</ng-template>\r\n<div class=\"treeview-header\">\r\n  <ng-template [ngTemplateOutlet]=\"headerTemplate || defaultHeaderTemplate\"\r\n    [ngTemplateOutletContext]=\"headerTemplateContext\">\r\n  </ng-template>\r\n</div>\r\n<div [ngSwitch]=\"hasFilterItems\">\r\n  <div *ngSwitchCase=\"true\" class=\"treeview-container\" [style.max-height.px]=\"maxHeight\">\r\n    <ngx-treeview-item *ngFor=\"let item of filterItems\" [config]=\"config\" [item]=\"item\"\r\n      [template]=\"itemTemplate || defaultItemTemplate\" (checkedChange)=\"onItemCheckedChange(item, $event)\">\r\n    </ngx-treeview-item>\r\n  </div>\r\n  <div *ngSwitchCase=\"false\" class=\"treeview-text\">\r\n    {{i18n.getFilterNoItemsFoundText()}}\r\n  </div>\r\n</div>\r\n",
                styles: [":host .treeview-header .row-filter{margin-bottom:.5rem}:host .treeview-header .row-all .bi{cursor:pointer}:host .treeview-container .row-item{flex-wrap:nowrap;margin-bottom:.3rem}:host .treeview-container .row-item .bi{cursor:pointer;margin-right:.3rem}.treeview-container{overflow-y:auto;padding-right:.3rem}.treeview-text{padding:.3rem 0;white-space:nowrap}"]
            },] }
];
TreeviewComponent.ctorParameters = () => [
    { type: TreeviewI18n },
    { type: TreeviewConfig },
    { type: TreeviewEventParser }
];
TreeviewComponent.propDecorators = {
    headerTemplate: [{ type: Input }],
    itemTemplate: [{ type: Input }],
    items: [{ type: Input }],
    config: [{ type: Input }],
    selectedChange: [{ type: Output }],
    filterChange: [{ type: Output }]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZXZpZXcuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LXRyZWV2aWV3L3NyYy9saWIvY29tcG9uZW50cy90cmVldmlldy90cmVldmlldy5jb21wb25lbnQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBaUQsTUFBTSxlQUFlLENBQUM7QUFDdEgsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDekMsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzFELE9BQU8sRUFBRSxZQUFZLEVBQXFCLE1BQU0sNEJBQTRCLENBQUM7QUFDN0UsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRzlELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUxRSxNQUFNLGtCQUFtQixTQUFRLFlBQVk7SUFFM0MsWUFBWSxJQUFrQjtRQUM1QixLQUFLLENBQUM7WUFDSixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7WUFDakIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztZQUNyQixTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVM7WUFDekIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1NBQ3hCLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxnQkFBZ0I7UUFDZCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUM1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TyxrQkFBa0I7UUFDeEIsSUFBSSxXQUFXLEdBQVksSUFBSSxDQUFDO1FBQ2hDLEtBQUssTUFBTSxVQUFVLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUN6QyxJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUU7Z0JBQ3hCLFdBQVcsR0FBRyxVQUFVLENBQUMsT0FBTyxDQUFDO2FBQ2xDO2lCQUFNLElBQUksV0FBVyxLQUFLLFVBQVUsQ0FBQyxPQUFPLEVBQUU7Z0JBQzdDLFdBQVcsR0FBRyxTQUFTLENBQUM7Z0JBQ3hCLE1BQU07YUFDUDtTQUNGO1FBRUQsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFO1lBQ3hCLFdBQVcsR0FBRyxLQUFLLENBQUM7U0FDckI7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sR0FBRyxXQUFXLENBQUM7SUFDckMsQ0FBQztJQUVPLG9CQUFvQjtRQUMxQixJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUM7UUFDNUIsS0FBSyxNQUFNLFVBQVUsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3pDLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxFQUFFO2dCQUN6QixlQUFlLEdBQUcsSUFBSSxDQUFDO2dCQUN2QixNQUFNO2FBQ1A7U0FDRjtRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxHQUFHLENBQUMsZUFBZSxDQUFDO0lBQzVDLENBQUM7OztZQTNNRixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLGNBQWM7Z0JBQ3hCLDJ3S0FBd0M7O2FBRXpDOzs7WUE5Q1EsWUFBWTtZQUVaLGNBQWM7WUFJZCxtQkFBbUI7Ozs2QkEwQ3pCLEtBQUs7MkJBQ0wsS0FBSztvQkFDTCxLQUFLO3FCQUNMLEtBQUs7NkJBQ0wsTUFBTTsyQkFDTixNQUFNIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29tcG9uZW50LCBJbnB1dCwgT3V0cHV0LCBFdmVudEVtaXR0ZXIsIFNpbXBsZUNoYW5nZXMsIE9uQ2hhbmdlcywgVGVtcGxhdGVSZWYsIE9uSW5pdCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xyXG5pbXBvcnQgeyBpc05pbCwgaW5jbHVkZXMgfSBmcm9tICdsb2Rhc2gnO1xyXG5pbXBvcnQgeyBUcmVldmlld0kxOG4gfSBmcm9tICcuLi8uLi9tb2RlbHMvdHJlZXZpZXctaTE4bic7XHJcbmltcG9ydCB7IFRyZWV2aWV3SXRlbSwgVHJlZXZpZXdTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi9tb2RlbHMvdHJlZXZpZXctaXRlbSc7XHJcbmltcG9ydCB7IFRyZWV2aWV3Q29uZmlnIH0gZnJvbSAnLi4vLi4vbW9kZWxzL3RyZWV2aWV3LWNvbmZpZyc7XHJcbmltcG9ydCB7IFRyZWV2aWV3SGVhZGVyVGVtcGxhdGVDb250ZXh0IH0gZnJvbSAnLi4vLi4vbW9kZWxzL3RyZWV2aWV3LWhlYWRlci10ZW1wbGF0ZS1jb250ZXh0JztcclxuaW1wb3J0IHsgVHJlZXZpZXdJdGVtVGVtcGxhdGVDb250ZXh0IH0gZnJvbSAnLi4vLi4vbW9kZWxzL3RyZWV2aWV3LWl0ZW0tdGVtcGxhdGUtY29udGV4dCc7XHJcbmltcG9ydCB7IFRyZWV2aWV3SGVscGVyIH0gZnJvbSAnLi4vLi4vaGVscGVycy90cmVldmlldy1oZWxwZXInO1xyXG5pbXBvcnQgeyBUcmVldmlld0V2ZW50UGFyc2VyIH0gZnJvbSAnLi4vLi4vaGVscGVycy90cmVldmlldy1ldmVudC1wYXJzZXInO1xyXG5cclxuY2xhc3MgRmlsdGVyVHJlZXZpZXdJdGVtIGV4dGVuZHMgVHJlZXZpZXdJdGVtIHtcclxuICBwcml2YXRlIHJlYWRvbmx5IHJlZkl0ZW06IFRyZWV2aWV3SXRlbTtcclxuICBjb25zdHJ1Y3RvcihpdGVtOiBUcmVldmlld0l0ZW0pIHtcclxuICAgIHN1cGVyKHtcclxuICAgICAgdGV4dDogaXRlbS50ZXh0LFxyXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcclxuICAgICAgZGlzYWJsZWQ6IGl0ZW0uZGlzYWJsZWQsXHJcbiAgICAgIGNoZWNrZWQ6IGl0ZW0uY2hlY2tlZCxcclxuICAgICAgY29sbGFwc2VkOiBpdGVtLmNvbGxhcHNlZCxcclxuICAgICAgY2hpbGRyZW46IGl0ZW0uY2hpbGRyZW5cclxuICAgIH0pO1xyXG4gICAgdGhpcy5yZWZJdGVtID0gaXRlbTtcclxuICB9XHJcblxyXG4gIHVwZGF0ZVJlZkNoZWNrZWQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xyXG4gICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBGaWx0ZXJUcmVldmlld0l0ZW0pIHtcclxuICAgICAgICBjaGlsZC51cGRhdGVSZWZDaGVja2VkKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxldCByZWZDaGVja2VkID0gdGhpcy5jaGVja2VkO1xyXG4gICAgaWYgKHJlZkNoZWNrZWQpIHtcclxuICAgICAgZm9yIChjb25zdCByZWZDaGlsZCBvZiB0aGlzLnJlZkl0ZW0uY2hpbGRyZW4pIHtcclxuICAgICAgICBpZiAoIXJlZkNoaWxkLmNoZWNrZWQpIHtcclxuICAgICAgICAgIHJlZkNoZWNrZWQgPSBmYWxzZTtcclxuICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdGhpcy5yZWZJdGVtLmNoZWNrZWQgPSByZWZDaGVja2VkO1xyXG4gIH1cclxufVxyXG5cclxuQENvbXBvbmVudCh7XHJcbiAgc2VsZWN0b3I6ICduZ3gtdHJlZXZpZXcnLFxyXG4gIHRlbXBsYXRlVXJsOiAnLi90cmVldmlldy5jb21wb25lbnQuaHRtbCcsXHJcbiAgc3R5bGVVcmxzOiBbJy4vdHJlZXZpZXcuY29tcG9uZW50LnNjc3MnXVxyXG59KVxyXG5leHBvcnQgY2xhc3MgVHJlZXZpZXdDb21wb25lbnQgaW1wbGVtZW50cyBPbkNoYW5nZXMsIE9uSW5pdCB7XHJcbiAgQElucHV0KCkgaGVhZGVyVGVtcGxhdGU6IFRlbXBsYXRlUmVmPFRyZWV2aWV3SGVhZGVyVGVtcGxhdGVDb250ZXh0PjtcclxuICBASW5wdXQoKSBpdGVtVGVtcGxhdGU6IFRlbXBsYXRlUmVmPFRyZWV2aWV3SXRlbVRlbXBsYXRlQ29udGV4dD47XHJcbiAgQElucHV0KCkgaXRlbXM6IFRyZWV2aWV3SXRlbVtdO1xyXG4gIEBJbnB1dCgpIGNvbmZpZzogVHJlZXZpZXdDb25maWc7XHJcbiAgQE91dHB1dCgpIHNlbGVjdGVkQ2hhbmdlID0gbmV3IEV2ZW50RW1pdHRlcjxhbnlbXT4oKTtcclxuICBAT3V0cHV0KCkgZmlsdGVyQ2hhbmdlID0gbmV3IEV2ZW50RW1pdHRlcjxzdHJpbmc+KCk7XHJcbiAgaGVhZGVyVGVtcGxhdGVDb250ZXh0OiBUcmVldmlld0hlYWRlclRlbXBsYXRlQ29udGV4dDtcclxuICBhbGxJdGVtOiBUcmVldmlld0l0ZW07XHJcbiAgZmlsdGVyVGV4dCA9ICcnO1xyXG4gIGZpbHRlckl0ZW1zOiBUcmVldmlld0l0ZW1bXTtcclxuICBzZWxlY3Rpb246IFRyZWV2aWV3U2VsZWN0aW9uO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIHB1YmxpYyBpMThuOiBUcmVldmlld0kxOG4sXHJcbiAgICBwcml2YXRlIGRlZmF1bHRDb25maWc6IFRyZWV2aWV3Q29uZmlnLFxyXG4gICAgcHJpdmF0ZSBldmVudFBhcnNlcjogVHJlZXZpZXdFdmVudFBhcnNlclxyXG4gICkge1xyXG4gICAgdGhpcy5jb25maWcgPSB0aGlzLmRlZmF1bHRDb25maWc7XHJcbiAgICB0aGlzLmFsbEl0ZW0gPSBuZXcgVHJlZXZpZXdJdGVtKHsgdGV4dDogJ0FsbCcsIHZhbHVlOiB1bmRlZmluZWQgfSk7XHJcbiAgfVxyXG5cclxuICBnZXQgaGFzRmlsdGVySXRlbXMoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gIWlzTmlsKHRoaXMuZmlsdGVySXRlbXMpICYmIHRoaXMuZmlsdGVySXRlbXMubGVuZ3RoID4gMDtcclxuICB9XHJcblxyXG4gIGdldCBtYXhIZWlnaHQoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBgJHt0aGlzLmNvbmZpZy5tYXhIZWlnaHR9YDtcclxuICB9XHJcblxyXG4gIG5nT25Jbml0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5jcmVhdGVIZWFkZXJUZW1wbGF0ZUNvbnRleHQoKTtcclxuICAgIHRoaXMuZ2VuZXJhdGVTZWxlY3Rpb24oKTtcclxuICB9XHJcblxyXG4gIG5nT25DaGFuZ2VzKGNoYW5nZXM6IFNpbXBsZUNoYW5nZXMpOiB2b2lkIHtcclxuICAgIGNvbnN0IGl0ZW1zU2ltcGxlQ2hhbmdlID0gY2hhbmdlcy5pdGVtcztcclxuICAgIGlmICghaXNOaWwoaXRlbXNTaW1wbGVDaGFuZ2UpICYmICFpc05pbCh0aGlzLml0ZW1zKSkge1xyXG4gICAgICB0aGlzLnVwZGF0ZUZpbHRlckl0ZW1zKCk7XHJcbiAgICAgIHRoaXMudXBkYXRlQ29sbGFwc2VkT2ZBbGwoKTtcclxuICAgICAgdGhpcy5yYWlzZVNlbGVjdGVkQ2hhbmdlKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBvbkFsbENvbGxhcHNlRXhwYW5kKCk6IHZvaWQge1xyXG4gICAgdGhpcy5hbGxJdGVtLmNvbGxhcHNlZCA9ICF0aGlzLmFsbEl0ZW0uY29sbGFwc2VkO1xyXG4gICAgdGhpcy5maWx0ZXJJdGVtcy5mb3JFYWNoKGl0ZW0gPT4gaXRlbS5zZXRDb2xsYXBzZWRSZWN1cnNpdmUodGhpcy5hbGxJdGVtLmNvbGxhcHNlZCkpO1xyXG4gIH1cclxuXHJcbiAgb25GaWx0ZXJUZXh0Q2hhbmdlKHRleHQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5maWx0ZXJUZXh0ID0gdGV4dDtcclxuICAgIHRoaXMuZmlsdGVyQ2hhbmdlLmVtaXQodGV4dCk7XHJcbiAgICB0aGlzLnVwZGF0ZUZpbHRlckl0ZW1zKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJRSBoYXMgYW4gaXNzdWUgd2hlcmUgaXQgZG9lcyBub3Qgc2VuZCBhIGNoYW5nZSBldmVudCBmb3Igd2hlbiBhbiBpbmRldGVybWluYXRlIGNoZWNrYm94IGNoYW5nZXMgdG8gYmVjb21lIGRldGVybWluYXRlLlxyXG4gICAqIFRvIHdvcmsgYXJvdW5kIHRoaXMgd2UgZXhwbGljaXR5IHNldCBpdCBjaGVja2VkIGlmIGl0J3MgaW5kZXRlcm1pbmF0ZSBhbmQgd2UgdXNlIHRoZSBvbkNsaWNrIGV2ZW50IGluc3RlYWQgb2Ygb25DaGFuZ2UuXHJcbiAgICovXHJcbiAgb25BbGxDaGVja2VkQ2hhbmdlKCk6IHZvaWQge1xyXG4gICAgdGhpcy5zdGFuZGFyZGl6ZUV2ZW50T3JkZXIoKCkgPT4ge1xyXG4gICAgICBpZiAodGhpcy5hbGxJdGVtLmluZGV0ZXJtaW5hdGUpIHtcclxuICAgICAgICB0aGlzLmFsbEl0ZW0uY2hlY2tlZCA9IHRydWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGNoZWNrZWQgPSB0aGlzLmFsbEl0ZW0uY2hlY2tlZDtcclxuICAgICAgdGhpcy5maWx0ZXJJdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgICAgIGl0ZW0uc2V0Q2hlY2tlZFJlY3Vyc2l2ZShjaGVja2VkKTtcclxuICAgICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIEZpbHRlclRyZWV2aWV3SXRlbSkge1xyXG4gICAgICAgICAgaXRlbS51cGRhdGVSZWZDaGVja2VkKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMucmFpc2VTZWxlY3RlZENoYW5nZSgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJRSBwZXJmb3JtcyB0aGUgb25DbGljayBldmVudCBiZWZvcmUgdGhlIG9uQ2hhbmdlIGV2ZW50IHdoaWxlIENocm9tZSBhbmQgcGVyZm9ybSBpdCBpbiB0aGUgb3RoZXIgb3JkZXIuXHJcbiAgICogQnkgcHVzaGluZyB0aGUgY2FsbGJhY2sgb250byB0aGUgZXZlbnQgcXVldWUgaXQgd2lsbCBhbHdheXMgYmUgZXhlY3V0ZWQgaW1tZWRpYXRlbHkgYWZ0ZXIgYWxsIHBlbmRpbmcgZXZlbnRzXHJcbiAgICovXHJcbiAgc3RhbmRhcmRpemVFdmVudE9yZGVyKGNhbGxiYWNrKTogdm9pZCB7XHJcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAwKTtcclxuICB9XHJcblxyXG4gIG9uSXRlbUNoZWNrZWRDaGFuZ2UoaXRlbTogVHJlZXZpZXdJdGVtLCBjaGVja2VkOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIEZpbHRlclRyZWV2aWV3SXRlbSkge1xyXG4gICAgICBpdGVtLnVwZGF0ZVJlZkNoZWNrZWQoKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnVwZGF0ZUNoZWNrZWRPZkFsbCgpO1xyXG4gICAgdGhpcy5yYWlzZVNlbGVjdGVkQ2hhbmdlKCk7XHJcbiAgfVxyXG5cclxuICByYWlzZVNlbGVjdGVkQ2hhbmdlKCk6IHZvaWQge1xyXG4gICAgdGhpcy5nZW5lcmF0ZVNlbGVjdGlvbigpO1xyXG4gICAgY29uc3QgdmFsdWVzID0gdGhpcy5ldmVudFBhcnNlci5nZXRTZWxlY3RlZENoYW5nZSh0aGlzKTtcclxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICB0aGlzLnNlbGVjdGVkQ2hhbmdlLmVtaXQodmFsdWVzKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjcmVhdGVIZWFkZXJUZW1wbGF0ZUNvbnRleHQoKTogdm9pZCB7XHJcbiAgICB0aGlzLmhlYWRlclRlbXBsYXRlQ29udGV4dCA9IHtcclxuICAgICAgY29uZmlnOiB0aGlzLmNvbmZpZyxcclxuICAgICAgaXRlbTogdGhpcy5hbGxJdGVtLFxyXG4gICAgICBvbkNoZWNrZWRDaGFuZ2U6ICgpID0+IHRoaXMub25BbGxDaGVja2VkQ2hhbmdlKCksXHJcbiAgICAgIG9uQ29sbGFwc2VFeHBhbmQ6ICgpID0+IHRoaXMub25BbGxDb2xsYXBzZUV4cGFuZCgpLFxyXG4gICAgICBvbkZpbHRlclRleHRDaGFuZ2U6ICh0ZXh0KSA9PiB0aGlzLm9uRmlsdGVyVGV4dENoYW5nZSh0ZXh0KVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2VuZXJhdGVTZWxlY3Rpb24oKTogdm9pZCB7XHJcbiAgICBsZXQgY2hlY2tlZEl0ZW1zOiBUcmVldmlld0l0ZW1bXSA9IFtdO1xyXG4gICAgbGV0IHVuY2hlY2tlZEl0ZW1zOiBUcmVldmlld0l0ZW1bXSA9IFtdO1xyXG4gICAgaWYgKCFpc05pbCh0aGlzLml0ZW1zKSkge1xyXG4gICAgICBjb25zdCBzZWxlY3Rpb24gPSBUcmVldmlld0hlbHBlci5jb25jYXRTZWxlY3Rpb24odGhpcy5pdGVtcywgY2hlY2tlZEl0ZW1zLCB1bmNoZWNrZWRJdGVtcyk7XHJcbiAgICAgIGNoZWNrZWRJdGVtcyA9IHNlbGVjdGlvbi5jaGVja2VkO1xyXG4gICAgICB1bmNoZWNrZWRJdGVtcyA9IHNlbGVjdGlvbi51bmNoZWNrZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zZWxlY3Rpb24gPSB7XHJcbiAgICAgIGNoZWNrZWRJdGVtcyxcclxuICAgICAgdW5jaGVja2VkSXRlbXNcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUZpbHRlckl0ZW1zKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZmlsdGVyVGV4dCAhPT0gJycpIHtcclxuICAgICAgY29uc3QgZmlsdGVySXRlbXM6IFRyZWV2aWV3SXRlbVtdID0gW107XHJcbiAgICAgIGNvbnN0IGZpbHRlclRleHQgPSB0aGlzLmZpbHRlclRleHQudG9Mb3dlckNhc2UoKTtcclxuICAgICAgdGhpcy5pdGVtcy5mb3JFYWNoKGl0ZW0gPT4ge1xyXG4gICAgICAgIGNvbnN0IG5ld0l0ZW0gPSB0aGlzLmZpbHRlckl0ZW0oaXRlbSwgZmlsdGVyVGV4dCk7XHJcbiAgICAgICAgaWYgKCFpc05pbChuZXdJdGVtKSkge1xyXG4gICAgICAgICAgZmlsdGVySXRlbXMucHVzaChuZXdJdGVtKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICB0aGlzLmZpbHRlckl0ZW1zID0gZmlsdGVySXRlbXM7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmZpbHRlckl0ZW1zID0gdGhpcy5pdGVtcztcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnVwZGF0ZUNoZWNrZWRPZkFsbCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBmaWx0ZXJJdGVtKGl0ZW06IFRyZWV2aWV3SXRlbSwgZmlsdGVyVGV4dDogc3RyaW5nKTogVHJlZXZpZXdJdGVtIHtcclxuICAgIGNvbnN0IGlzTWF0Y2ggPSBpbmNsdWRlcyhpdGVtLnRleHQudG9Mb3dlckNhc2UoKSwgZmlsdGVyVGV4dCk7XHJcbiAgICBpZiAoaXNNYXRjaCkge1xyXG4gICAgICByZXR1cm4gaXRlbTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICghaXNOaWwoaXRlbS5jaGlsZHJlbikpIHtcclxuICAgICAgICBjb25zdCBjaGlsZHJlbjogVHJlZXZpZXdJdGVtW10gPSBbXTtcclxuICAgICAgICBpdGVtLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xyXG4gICAgICAgICAgY29uc3QgbmV3Q2hpbGQgPSB0aGlzLmZpbHRlckl0ZW0oY2hpbGQsIGZpbHRlclRleHQpO1xyXG4gICAgICAgICAgaWYgKCFpc05pbChuZXdDaGlsZCkpIHtcclxuICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChuZXdDaGlsZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgaWYgKGNoaWxkcmVuLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIGNvbnN0IG5ld0l0ZW0gPSBuZXcgRmlsdGVyVHJlZXZpZXdJdGVtKGl0ZW0pO1xyXG4gICAgICAgICAgbmV3SXRlbS5jb2xsYXBzZWQgPSBmYWxzZTtcclxuICAgICAgICAgIG5ld0l0ZW0uY2hpbGRyZW4gPSBjaGlsZHJlbjtcclxuICAgICAgICAgIHJldHVybiBuZXdJdGVtO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVwZGF0ZUNoZWNrZWRPZkFsbCgpOiB2b2lkIHtcclxuICAgIGxldCBpdGVtQ2hlY2tlZDogYm9vbGVhbiA9IG51bGw7XHJcbiAgICBmb3IgKGNvbnN0IGZpbHRlckl0ZW0gb2YgdGhpcy5maWx0ZXJJdGVtcykge1xyXG4gICAgICBpZiAoaXRlbUNoZWNrZWQgPT09IG51bGwpIHtcclxuICAgICAgICBpdGVtQ2hlY2tlZCA9IGZpbHRlckl0ZW0uY2hlY2tlZDtcclxuICAgICAgfSBlbHNlIGlmIChpdGVtQ2hlY2tlZCAhPT0gZmlsdGVySXRlbS5jaGVja2VkKSB7XHJcbiAgICAgICAgaXRlbUNoZWNrZWQgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXRlbUNoZWNrZWQgPT09IG51bGwpIHtcclxuICAgICAgaXRlbUNoZWNrZWQgPSBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmFsbEl0ZW0uY2hlY2tlZCA9IGl0ZW1DaGVja2VkO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1cGRhdGVDb2xsYXBzZWRPZkFsbCgpOiB2b2lkIHtcclxuICAgIGxldCBoYXNJdGVtRXhwYW5kZWQgPSBmYWxzZTtcclxuICAgIGZvciAoY29uc3QgZmlsdGVySXRlbSBvZiB0aGlzLmZpbHRlckl0ZW1zKSB7XHJcbiAgICAgIGlmICghZmlsdGVySXRlbS5jb2xsYXBzZWQpIHtcclxuICAgICAgICBoYXNJdGVtRXhwYW5kZWQgPSB0cnVlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5hbGxJdGVtLmNvbGxhcHNlZCA9ICFoYXNJdGVtRXhwYW5kZWQ7XHJcbiAgfVxyXG59XHJcbiJdfQ==