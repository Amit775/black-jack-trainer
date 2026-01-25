import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { BalanceService } from '../../services/balance.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  protected readonly balanceService = inject(BalanceService);

  protected depositAmount = 100;
  protected withdrawAmount = 0;

  deposit(): void {
    if (this.depositAmount > 0) {
      this.balanceService.deposit(this.depositAmount);
      this.depositAmount = 100;
    }
  }

  withdraw(): void {
    if (this.withdrawAmount > 0 && this.withdrawAmount <= this.balanceService.balance()) {
      this.balanceService.withdraw(this.withdrawAmount);
      this.withdrawAmount = 0;
    }
  }

  withdrawAll(): void {
    const currentBalance = this.balanceService.balance();
    if (currentBalance > 0) {
      this.balanceService.withdraw(currentBalance);
    }
  }

  navigateToPlay(): void {
    this.router.navigate(['/play']);
  }
}
