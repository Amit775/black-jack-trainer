import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { StatisticsService } from '../../services/statistics.service';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDividerModule,
  ],
  templateUrl: './statistics.html',
  styleUrl: './statistics.scss',
})
export class StatisticsComponent {
  protected readonly statisticsService = inject(StatisticsService);

  resetStats(): void {
    if (confirm('Are you sure you want to reset all statistics?')) {
      this.statisticsService.resetStatistics();
    }
  }
}
