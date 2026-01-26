import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { BlackjackStore } from '../../store';

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
  protected readonly store = inject(BlackjackStore);

  protected depositAmount = 100;
  protected withdrawAmount = 0;

  protected readonly balance = computed(() => this.store.balance());

  deposit(): void {
    if (this.depositAmount > 0) {
      this.store.deposit(this.depositAmount);
      this.depositAmount = 100;
    }
  }

  withdraw(): void {
    if (this.withdrawAmount > 0 && this.withdrawAmount <= this.balance()) {
      this.store.withdraw(this.withdrawAmount);
      this.withdrawAmount = 0;
    }
  }

  withdrawAll(): void {
    if (this.balance() > 0) {
      this.store.withdraw(this.balance());
    }
  }

  navigateToPlay(): void {
    this.router.navigate(['/play']);
  }
}
