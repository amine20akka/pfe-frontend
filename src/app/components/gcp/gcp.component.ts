import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { GCP } from '../../interfaces/gcp';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTooltipModule } from '@angular/material/tooltip';
import { trigger, transition, style, animate, state } from '@angular/animations';
import { GeorefService } from '../../services/georef.service';

const gcps: GCP[] = [
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 1, sourceX: 100, sourceY: 200, mapX: 50.12, mapY: 32.55, residual: 0.5 },
  { index: 2, sourceX: 300, sourceY: 150, mapX: 49.87, mapY: 32.42, residual: 0.8 }
];

@Component({
  selector: 'app-gcp',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    CommonModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  templateUrl: './gcp.component.html',
  styleUrl: './gcp.component.scss',
  animations: [
    trigger('toggleContent', [
      state('closed', style({ width: '0' })),
      state('open', style({ width: '100%' })),
      transition('* => *', animate('500ms ease-in-out')),
    ]),
  ]
})

export class GcpComponent {

  constructor(private georefService: GeorefService) { }

  displayedColumns: string[] = ['select', 'index', 'sourceX', 'sourceY', 'mapX', 'mapY', 'residual', 'edit', 'delete'];
  dataSource = new MatTableDataSource<GCP>(gcps);
  selection = new SelectionModel<GCP>(true, []);

  get isGeorefActive() {
    return this.georefService.isGeorefActive;
  }

  /** Whether the number of selected elements matches the total number of rows. */
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection. */
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource.data);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: GCP): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.index + 1}`;
  }

  trackByFn(item: GCP): number {
    return item.index;
  }
}
