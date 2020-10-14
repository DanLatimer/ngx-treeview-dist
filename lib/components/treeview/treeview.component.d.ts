import { EventEmitter, SimpleChanges, OnChanges, TemplateRef, OnInit } from '@angular/core';
import { TreeviewI18n } from '../../models/treeview-i18n';
import { TreeviewItem, TreeviewSelection } from '../../models/treeview-item';
import { TreeviewConfig } from '../../models/treeview-config';
import { TreeviewHeaderTemplateContext } from '../../models/treeview-header-template-context';
import { TreeviewItemTemplateContext } from '../../models/treeview-item-template-context';
import { TreeviewEventParser } from '../../helpers/treeview-event-parser';
export declare class TreeviewComponent implements OnChanges, OnInit {
    i18n: TreeviewI18n;
    private defaultConfig;
    private eventParser;
    headerTemplate: TemplateRef<TreeviewHeaderTemplateContext>;
    itemTemplate: TemplateRef<TreeviewItemTemplateContext>;
    items: TreeviewItem[];
    config: TreeviewConfig;
    selectedChange: EventEmitter<any[]>;
    filterChange: EventEmitter<string>;
    headerTemplateContext: TreeviewHeaderTemplateContext;
    allItem: TreeviewItem;
    filterText: string;
    filterItems: TreeviewItem[];
    selection: TreeviewSelection;
    constructor(i18n: TreeviewI18n, defaultConfig: TreeviewConfig, eventParser: TreeviewEventParser);
    get hasFilterItems(): boolean;
    get maxHeight(): string;
    ngOnInit(): void;
    ngOnChanges(changes: SimpleChanges): void;
    onAllCollapseExpand(): void;
    onFilterTextChange(text: string): void;
    /**
     * IE has an issue where it does not send a change event for when an indeterminate checkbox changes to become determinate.
     * To work around this we explicity set it checked if it's indeterminate and we use the onClick event instead of onChange.
     */
    onAllCheckedChange(): void;
    /**
     * IE performs the onClick event before the onChange event while Chrome and perform it in the other order.
     * By pushing the callback onto the event queue it will always be executed immediately after all pending events
     */
    standardizeEventOrder(callback: any): void;
    onItemCheckedChange(item: TreeviewItem, checked: boolean): void;
    raiseSelectedChange(): void;
    private createHeaderTemplateContext;
    private generateSelection;
    private updateFilterItems;
    private filterItem;
    private updateCheckedOfAll;
    private updateCollapsedOfAll;
}
